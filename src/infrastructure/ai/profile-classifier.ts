import type {
  AiConfigBundle,
  BeautyFilterConfig,
  GenderFilterConfig,
} from "../../config/ai-config.js";
import { isExcludedName } from "../../config/ai-config.js";
import { AiConsultationError } from "./ai-error.js";
import { parseBodyTypeResponse } from "./body-response-parser.js";
import { parseGenderResponse } from "./gender-response-parser.js";
import { parseScoringResponse } from "./scoring-parser.js";
import {
  descendingPhotoBudgets,
  selectVisionPhotos,
} from "./vision-photo-utils.js";
import type {
  ClassifierResult,
  ProfileClassifierPort,
  ProfileInfo,
} from "../../domain/types.js";

interface OllamaResponse {
  response: string;
}

const RETRY_DELAY_MS = 2_000;
const CONSULTATION_ATTEMPTS = 2;

const SCORE_FORMAT_REMINDER =
  "\n\nREMINDER: Reply with ONE line only using format 7:short reason. SCORE must be an integer from 1 to 10, not a word.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class ProfileClassifier implements ProfileClassifierPort {
  private readonly excludedNames: Set<string>;

  constructor(
    private readonly ollamaUrl: string,
    private readonly model: string,
    private readonly aiConfig: AiConfigBundle,
  ) {
    this.excludedNames = new Set(aiConfig.excludedNames.names);
  }

  async classify(profile: ProfileInfo): Promise<ClassifierResult> {
    const { genderFilter, beautyFilter } = this.aiConfig;
    const bioPreview = profile.bio
      ? profile.bio.substring(0, 80) + (profile.bio.length > 80 ? "..." : "")
      : "no bio";

    console.log(
      `[Profile] ── ${profile.name || "Unknown"}, ${profile.age || "?"} ── photos: ${profile.photos.length}`,
    );
    console.log(`[Profile]    bio: ${bioPreview}`);

    if (genderFilter.enabled && genderFilter.checkName) {
      if (isExcludedName(profile.name, this.excludedNames)) {
        console.log(`[Filter] ── SKIP (excluded name: ${profile.name})`);

        return { approved: false, rejectedBy: "name" };
      }
    }

    const hasPhotos = profile.photos.length > 0;

    if (hasPhotos && genderFilter.enabled) {
      if (genderFilter.checkGender) {
        const gender = await this.checkGender(profile.photos, genderFilter);

        if (gender !== "female") {
          console.log(`[Filter] ── SKIP (${gender} detected in photos)`);

          return { approved: false, rejectedBy: "gender" };
        }
      }

      if (genderFilter.checkBodyType) {
        const bodyType = await this.checkBodyType(profile, genderFilter);

        if (bodyType === "fail") {
          console.log("[Filter] ── SKIP (body type rejected)");

          return { approved: false, rejectedBy: "body" };
        }
      }
    }

    if (!hasPhotos && genderFilter.enabled && genderFilter.checkTextOnly) {
      return this.classifyTextOnly(profile, genderFilter);
    }

    if (!beautyFilter.enabled) {
      console.log("[AI] ── LIKE (beauty filter disabled)");

      return { approved: true };
    }

    return this.scoreAttractiveness(profile, beautyFilter);
  }

  async personalizeOpener(profile: ProfileInfo, baseOpener: string): Promise<string> {
    const hasMeaningfulBio = profile.bio
      && profile.bio.length > 3
      && /[a-zA-ZÀ-ÿ]{3,}/.test(profile.bio);

    if (!hasMeaningfulBio) {
      return baseOpener;
    }

    const prompt = this.aiConfig.openers.personalizePrompt
      .replace("{opener}", baseOpener)
      .replace("{name}", profile.name || "Unknown")
      .replace("{age}", profile.age || "?")
      .replace("{bio}", profile.bio);

    const result = await this.query(
      "opener personalization",
      prompt,
      [],
      80,
      this.aiConfig.genderFilter.temperature,
      this.aiConfig.genderFilter.timeoutMs,
    );
    const cleaned = result.trim();

    if (!cleaned || cleaned.length < 10) {
      return baseOpener;
    }

    if (this.containsBioFragment(cleaned, baseOpener, profile.bio)) {
      console.log(`[Opener] bio fragment detected, using base for ${profile.name || "Unknown"}`);

      return baseOpener;
    }

    console.log(`[Opener] personalized for ${profile.name || "Unknown"}`);

    return cleaned;
  }

  private async classifyTextOnly(
    profile: ProfileInfo,
    genderFilter: GenderFilterConfig,
  ): Promise<ClassifierResult> {
    const prompt = genderFilter.textOnlyPrompt
      .replace("{name}", profile.name || "Unknown")
      .replace("{age}", profile.age || "Unknown")
      .replace("{bio}", profile.bio || "No bio");

    const result = await this.query(
      "text-only classification",
      prompt,
      [],
      30,
      genderFilter.temperature,
      genderFilter.timeoutMs,
    );
    const cleaned = result.trim();
    const upper = cleaned.toUpperCase();
    const isSkip = upper.startsWith("SKIP")
      || upper.startsWith("DECISION:SKIP")
      || /^SKIP\b/i.test(cleaned);

    console.log(`[AI] ── ${isSkip ? "SKIP" : "LIKE"} (text-only: ${cleaned})`);

    return isSkip
      ? { approved: false, rejectedBy: "text" }
      : { approved: true };
  }

  private async scoreAttractiveness(
    profile: ProfileInfo,
    beautyFilter: BeautyFilterConfig,
  ): Promise<ClassifierResult> {
    const promptBase = beautyFilter.scoringPrompt
      .replace("{name}", profile.name || "Unknown")
      .replace("{age}", profile.age || "Unknown")
      .replace("{bio}", profile.bio || "No bio")
      .replace("{photoCount}", String(profile.photos.length))
      .replaceAll("{minScore}", String(beautyFilter.minScore));

    let lastResponse = "";

    for (let attempt = 0; attempt < CONSULTATION_ATTEMPTS; attempt++) {
      const prompt = attempt === 0
        ? promptBase
        : `${promptBase}${SCORE_FORMAT_REMINDER}`;

      const result = await this.query(
        "attractiveness scoring",
        prompt,
        profile.photos,
        60,
        beautyFilter.temperature,
        beautyFilter.timeoutMs,
      );
      const cleaned = result.trim();
      lastResponse = cleaned;
      const { score, reason } = parseScoringResponse(cleaned);

      if (score !== null) {
        const scoreLabel = `${score}/10`;
        const reasonLabel = reason ?? "no reason";
        const approved = score >= beautyFilter.minScore;

        console.log(
          `[AI] ── ${approved ? "LIKE" : "SKIP"} ${scoreLabel} (${reasonLabel}) [min: ${beautyFilter.minScore}]`,
        );

        return approved
          ? { approved: true }
          : { approved: false, rejectedBy: "score" };
      }

      if (attempt < CONSULTATION_ATTEMPTS - 1) {
        console.log(
          `[AI] attractiveness scoring unparseable (attempt ${attempt + 1}/${CONSULTATION_ATTEMPTS}): ${cleaned}`,
        );
      }
    }

    throw new AiConsultationError(
      "attractiveness scoring",
      `unparseable response: ${lastResponse}`,
    );
  }

  private containsBioFragment(result: string, baseOpener: string, bio: string): boolean {
    const added = result.replace(baseOpener, "").trim();

    if (!added) {
      return false;
    }

    const bioLower = bio.toLowerCase();
    const words = added.toLowerCase().split(/\s+/);

    for (let len = 4; len <= words.length; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const fragment = words.slice(i, i + len).join(" ");

        if (bioLower.includes(fragment)) {
          return true;
        }
      }
    }

    return false;
  }

  private async checkBodyType(
    profile: ProfileInfo,
    genderFilter: GenderFilterConfig,
  ): Promise<"pass" | "fail"> {
    const prompt = [
      genderFilter.bodyTypePrompt,
      "",
      "Profile:",
      `Name: ${profile.name || "Unknown"}, Age: ${profile.age || "Unknown"}`,
      `Bio: ${profile.bio || "No bio"}`,
    ].join("\n");

    const result = await this.query(
      "body type check",
      prompt,
      profile.photos,
      5,
      genderFilter.temperature,
      genderFilter.timeoutMs,
    );
    const bodyType = parseBodyTypeResponse(result);

    console.log(`[Filter]    body AI: ${result.trim()} → ${bodyType}`);

    return bodyType;
  }

  private async checkGender(
    photos: string[],
    genderFilter: GenderFilterConfig,
  ): Promise<"female" | "male" | "trans"> {
    const result = await this.query(
      "gender check",
      genderFilter.genderPrompt,
      photos,
      10,
      genderFilter.temperature,
      genderFilter.timeoutMs,
    );
    const gender = parseGenderResponse(result, genderFilter.rejectLabels);

    console.log(`[Filter]    gender AI: ${result.trim()} → ${gender}`);

    return gender;
  }

  private async query(
    context: string,
    prompt: string,
    images: string[],
    numPredict: number,
    temperature: number,
    timeoutMs: number,
  ): Promise<string> {
    const photoBudgets = descendingPhotoBudgets(images.length);

    let lastError: unknown;

    for (let attempt = 0; attempt < photoBudgets.length; attempt++) {
      const photoCount = photoBudgets[attempt]!;
      const selectedImages = photoCount > 0
        ? selectVisionPhotos(images, photoCount)
        : [];

      try {
        return await this.queryOnce(
          context,
          prompt,
          selectedImages,
          numPredict,
          temperature,
          timeoutMs,
        );
      } catch (error) {
        lastError = error;

        if (attempt < photoBudgets.length - 1) {
          const nextCount = photoBudgets[attempt + 1]!;

          console.log(
            `[AI] ${context} failed with ${photoCount} photo(s), retrying with ${nextCount}...`,
          );
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    if (lastError instanceof AiConsultationError) {
      throw lastError;
    }

    throw new AiConsultationError(context, lastError);
  }

  private async queryOnce(
    context: string,
    prompt: string,
    images: string[],
    numPredict: number,
    temperature: number,
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const body: Record<string, unknown> = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature,
        num_predict: numPredict,
      },
    };

    if (images.length > 0) {
      body.images = images;
    }

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AiConsultationError(
          context,
          `ollama responded with status ${response.status}`,
        );
      }

      const data = (await response.json()) as OllamaResponse;

      return data.response;
    } catch (error) {
      if (error instanceof AiConsultationError) {
        throw error;
      }

      throw new AiConsultationError(context, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
