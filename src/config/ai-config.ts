import fs from "node:fs";
import path from "node:path";
import type { PersonalContextEntry } from "../domain/types.js";
import { resolveDataPath } from "./data-dir.js";
import { envBool, envInt, envString } from "./env.js";

const AI_DIR = () => resolveDataPath("config", "ai");
const DEFAULT_BEAUTY_MIN_SCORE = 6;

export function resolveAiLanguage(): string {
  return envString("AI_LANGUAGE", "espanol").toLowerCase();
}

function resolveAiLanguageDir(): string {
  const lang = resolveAiLanguage();
  const dir = path.join(AI_DIR(), lang);

  if (!fs.existsSync(dir)) {
    throw new Error(`AI config not found for AI_LANGUAGE="${lang}" at ${dir}`);
  }

  return dir;
}

export interface GenderFilterConfig {
  enabled: boolean;
  checkName: boolean;
  checkGender: boolean;
  checkBodyType: boolean;
  checkTextOnly: boolean;
  rejectLabels: string[];
  genderPrompt: string;
  bodyTypePrompt: string;
  textOnlyPrompt: string;
  temperature: number;
  timeoutMs: number;
}

export interface BeautyFilterConfig {
  enabled: boolean;
  minScore: number;
  scoringPrompt: string;
  temperature: number;
  timeoutMs: number;
}

export interface ExcludedNamesConfig {
  names: string[];
}

export interface OpenersConfig {
  messages: string[];
  personalizePrompt: string;
}

export interface ChatAiConfig {
  personaName: string;
  instagramHandle: string;
  selfHandles: string[];
  systemPrompt: string;
  bannedPhrases: string[];
  bannedEmojis: string[];
  phaseHints: {
    rapport4: string;
    instagram6: string;
  };
  instagramAskPattern: string;
  systemConversations: string[];
  systemMessagePatterns: string[];
  temperature: number;
  maxRetries: number;
  timeoutMs: number;
  maxHistoryMessages: number;
}

export interface PersonalContextConfig {
  entries: Array<{ question: string; answer: string }>;
}

export interface AiConfigBundle {
  genderFilter: GenderFilterConfig;
  beautyFilter: BeautyFilterConfig;
  excludedNames: ExcludedNamesConfig;
  openers: OpenersConfig;
  chat: ChatAiConfig;
  personalContext: PersonalContextEntry[];
}

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");

  return JSON.parse(raw) as T;
}

function normalizePrompt(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.join("\n");
  }

  return value;
}

interface GenderFilterConfigRaw extends Omit<GenderFilterConfig, "genderPrompt" | "bodyTypePrompt" | "textOnlyPrompt"> {
  genderPrompt: string | string[];
  bodyTypePrompt: string | string[];
  textOnlyPrompt: string | string[];
}

interface BeautyFilterConfigRaw extends Omit<BeautyFilterConfig, "scoringPrompt" | "minScore"> {
  scoringPrompt: string | string[];
}

interface OpenersConfigRaw extends Omit<OpenersConfig, "personalizePrompt"> {
  personalizePrompt: string | string[];
}

interface ChatAiConfigRaw extends Omit<ChatAiConfig, "systemPrompt" | "phaseHints"> {
  systemPrompt: string | string[];
  phaseHints: {
    rapport4: string | string[];
    instagram6: string | string[];
  };
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function loadAiConfig(): AiConfigBundle {
  const langDir = resolveAiLanguageDir();
  const genderRaw = readJson<GenderFilterConfigRaw>(
    path.join(AI_DIR(), "gender-filter.json"),
  );
  const beautyRaw = readJson<BeautyFilterConfigRaw>(
    path.join(AI_DIR(), "beauty-filter.json"),
  );
  const excludedNames = readJson<ExcludedNamesConfig>(
    path.join(AI_DIR(), "excluded-names.json"),
  );
  const openersRaw = readJson<OpenersConfigRaw>(path.join(langDir, "openers.json"));
  const chatRaw = readJson<ChatAiConfigRaw>(path.join(langDir, "chat.json"));
  const personalContextRaw = readJson<PersonalContextConfig>(
    path.join(langDir, "personal-context.json"),
  );

  const genderFilter: GenderFilterConfig = {
    ...genderRaw,
    genderPrompt: normalizePrompt(genderRaw.genderPrompt),
    bodyTypePrompt: normalizePrompt(genderRaw.bodyTypePrompt),
    textOnlyPrompt: normalizePrompt(genderRaw.textOnlyPrompt),
  };
  const beautyFilter: Omit<BeautyFilterConfig, "minScore"> = {
    ...beautyRaw,
    scoringPrompt: normalizePrompt(beautyRaw.scoringPrompt),
  };
  const openers: OpenersConfig = {
    ...openersRaw,
    personalizePrompt: normalizePrompt(openersRaw.personalizePrompt),
  };
  const chat: ChatAiConfig = {
    ...chatRaw,
    systemPrompt: normalizePrompt(chatRaw.systemPrompt),
    phaseHints: {
      rapport4: normalizePrompt(chatRaw.phaseHints.rapport4),
      instagram6: normalizePrompt(chatRaw.phaseHints.instagram6),
    },
  };

  const personalContext: PersonalContextEntry[] = personalContextRaw.entries.map(
    (e) => ({
      question: e.question,
      answer: e.answer,
      askedBy: "config",
      askedAt: "",
    }),
  );

  const normalizedNames = new Set(
    excludedNames.names.map((n) => normalizeName(n)),
  );

  return {
    genderFilter: {
      ...genderFilter,
      enabled: envBool("GENDER_FILTER_ENABLED", genderFilter.enabled),
    },
    beautyFilter: {
      ...beautyFilter,
      enabled: envBool("BEAUTY_FILTER_ENABLED", beautyFilter.enabled),
      minScore: envInt("BEAUTY_MIN_SCORE", DEFAULT_BEAUTY_MIN_SCORE),
    },
    excludedNames: { names: [...normalizedNames] },
    openers,
    chat,
    personalContext,
  };
}

export function pickRandomOpener(messages: string[]): string {
  const index = Math.floor(Math.random() * messages.length);

  return messages[index];
}

export function isExcludedName(
  name: string,
  excludedNames: Set<string>,
): boolean {
  if (!name) {
    return false;
  }

  const firstName = normalizeName(name.split(/\s+/)[0]);

  return excludedNames.has(firstName);
}
