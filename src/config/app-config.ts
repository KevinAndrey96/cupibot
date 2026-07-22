import type { ChatConfig, ChatSessionConfig, Platform, SessionConfig } from "../domain/types.js";
import type { AiConfigBundle } from "./ai-config.js";
import { envBool, envInt, envOneOf, envString, normalizeOllamaUrl } from "./env.js";

export type AppMode =
  | "tinder-swipe"
  | "tinder-chat"
  | "bumble-swipe"
  | "tinder-swipe-chat"
  | "tinder-analisis";

export interface ResolvedAppConfig {
  browser: { headless: boolean };
  ollama: { url: string; swipeModel: string; chatModel: string };
  swipe: {
    tinder: { minSwipes: number; maxSwipes: number };
    bumble: { minSwipes: number; maxSwipes: number };
    minDelayMs: number;
    maxDelayMs: number;
    batchPauseMinMs: number;
    batchPauseMaxMs: number;
    batchSizeMin: number;
    batchSizeMax: number;
    swipeCooldownMs: number;
    viewingDelayMaxMs: number;
    restBreakMinMs: number;
    restBreakMaxMs: number;
    chatBreakResumeMs: number;
    chatBreakInterval: number;
    sendOpenerOnMatch: Record<Platform, boolean>;
    onExtractFailure: "like" | "pass";
  };
  chat: {
    dryRun: boolean;
    replyAll: boolean;
    sendDelayS: number;
    maxConversations: number;
    cycleMinMin: number;
    cycleMaxMin: number;
  };
}

export function loadAppConfig(): ResolvedAppConfig {
  return {
    browser: {
      headless: envBool("HEADLESS", false),
    },
    ollama: {
      url: normalizeOllamaUrl(envString("OLLAMA_URL", "http://127.0.0.1:11434")),
      swipeModel: envString("SWIPE_MODEL", "llava:7b"),
      chatModel: envString("CHAT_MODEL", "qwen2.5:7b"),
    },
    swipe: {
      tinder: {
        minSwipes: envInt("TINDER_MIN_SWIPES", 100),
        maxSwipes: envInt("TINDER_MAX_SWIPES", 150),
      },
      bumble: {
        minSwipes: envInt("BUMBLE_MIN_SWIPES", 100),
        maxSwipes: envInt("BUMBLE_MAX_SWIPES", 150),
      },
      minDelayMs: envInt("MIN_DELAY_MS", 0),
      maxDelayMs: envInt("MAX_DELAY_MS", 0),
      batchPauseMinMs: envInt("BATCH_PAUSE_MIN_MS", 0),
      batchPauseMaxMs: envInt("BATCH_PAUSE_MAX_MS", 0),
      batchSizeMin: envInt("BATCH_SIZE_MIN", 9999),
      batchSizeMax: envInt("BATCH_SIZE_MAX", 9999),
      swipeCooldownMs: envInt("SWIPE_COOLDOWN_MS", 0),
      viewingDelayMaxMs: envInt("VIEWING_DELAY_MAX_MS", 0),
      restBreakMinMs: envInt("REST_BREAK_MIN_MS", 0),
      restBreakMaxMs: envInt("REST_BREAK_MAX_MS", 0),
      chatBreakResumeMs: envInt("CHAT_BREAK_RESUME_MS", 0),
      chatBreakInterval: envInt("CHAT_BREAK_INTERVAL", 10),
      sendOpenerOnMatch: {
        tinder: envBool("SEND_OPENER_ON_MATCH_TINDER", true),
        bumble: envBool("SEND_OPENER_ON_MATCH_BUMBLE", false),
      },
      onExtractFailure: envOneOf(
        "ON_EXTRACT_FAILURE",
        ["like", "pass"] as const,
        "pass",
      ),
    },
    chat: {
      dryRun: envBool("CHAT_DRY_RUN", false),
      replyAll: envBool("CHAT_REPLY_ALL", false),
      sendDelayS: envInt("CHAT_SEND_DELAY_S", 0),
      maxConversations: envInt("CHAT_MAX_CONVERSATIONS", 10),
      cycleMinMin: envInt("CHAT_CYCLE_MIN_MIN", 0),
      cycleMaxMin: envInt("CHAT_CYCLE_MAX_MIN", 0),
    },
  };
}

export function resolveSwipeCount(
  app: ResolvedAppConfig,
  platform: Platform,
): number {
  const range = app.swipe[platform];
  const span = range.maxSwipes - range.minSwipes;

  return range.minSwipes + Math.floor(Math.random() * (span + 1));
}

export function buildSessionConfig(
  app: ResolvedAppConfig,
  platform: Platform,
  minAttractivenessScore: number,
): SessionConfig {
  const config: SessionConfig = {
    headless: app.browser.headless,
    maxSwipes: resolveSwipeCount(app, platform),
    minDelayMs: app.swipe.minDelayMs,
    maxDelayMs: app.swipe.maxDelayMs,
    batchPauseMinMs: app.swipe.batchPauseMinMs,
    batchPauseMaxMs: app.swipe.batchPauseMaxMs,
    batchSizeMin: app.swipe.batchSizeMin,
    batchSizeMax: app.swipe.batchSizeMax,
    swipeCooldownMs: app.swipe.swipeCooldownMs,
    viewingDelayMaxMs: app.swipe.viewingDelayMaxMs,
    restBreakMinMs: app.swipe.restBreakMinMs,
    restBreakMaxMs: app.swipe.restBreakMaxMs,
    chatBreakResumeMs: app.swipe.chatBreakResumeMs,
    swipeModel: app.ollama.swipeModel,
    ollamaUrl: app.ollama.url,
    minAttractivenessScore,
    chatBreakInterval: app.swipe.chatBreakInterval,
    onExtractFailure: app.swipe.onExtractFailure,
  };

  validateSessionConfig(config, app, platform);

  return config;
}

export function buildChatConfig(app: ResolvedAppConfig): ChatConfig {
  return {
    chatDryRun: app.chat.dryRun,
    chatReplyAll: app.chat.replyAll,
    chatModel: app.ollama.chatModel,
    chatSendDelayS: app.chat.sendDelayS,
    chatMaxConversations: app.chat.maxConversations,
    chatCycleMinMin: app.chat.cycleMinMin,
    chatCycleMaxMin: app.chat.cycleMaxMin,
    ollamaUrl: app.ollama.url,
    headless: app.browser.headless,
  };
}

function validateSessionConfig(
  config: SessionConfig,
  app: ResolvedAppConfig,
  platform: Platform,
): void {
  const range = app.swipe[platform];

  if (range.minSwipes < 1 || range.maxSwipes < range.minSwipes) {
    throw new Error(
      `${platform} minSwipes must be >= 1 and maxSwipes must be >= minSwipes`,
    );
  }

  if (config.maxSwipes < 1) {
    throw new Error("maxSwipes must be at least 1");
  }

  if (config.minDelayMs < 0 || config.maxDelayMs < config.minDelayMs) {
    throw new Error(
      "minDelayMs must be >= 0 and maxDelayMs must be >= minDelayMs",
    );
  }

  if (
    config.batchPauseMinMs < 0 ||
    config.batchPauseMaxMs < config.batchPauseMinMs
  ) {
    throw new Error(
      "batchPauseMinMs must be >= 0 and batchPauseMaxMs must be >= batchPauseMinMs",
    );
  }

  if (config.batchSizeMin < 1 || config.batchSizeMax < config.batchSizeMin) {
    throw new Error(
      "batchSizeMin must be >= 1 and batchSizeMax must be >= batchSizeMin",
    );
  }

  if (config.chatBreakInterval < 1) {
    throw new Error("chatBreakInterval must be at least 1");
  }

  if (config.viewingDelayMaxMs < 0) {
    throw new Error("viewingDelayMaxMs must be >= 0");
  }

  if (
    config.restBreakMinMs < 0 ||
    config.restBreakMaxMs < config.restBreakMinMs
  ) {
    throw new Error(
      "restBreakMinMs must be >= 0 and restBreakMaxMs must be >= restBreakMinMs",
    );
  }

  if (config.chatBreakResumeMs < 0) {
    throw new Error("chatBreakResumeMs must be >= 0");
  }
}

export function modeLabel(mode: AppMode): string {
  switch (mode) {
    case "tinder-swipe":
      return "Tinder Swipe";
    case "tinder-chat":
      return "Tinder Chat";
    case "bumble-swipe":
      return "Bumble Swipe";
    case "tinder-swipe-chat":
      return "Tinder Swipe + Chat";
    case "tinder-analisis":
      return "Tinder Análisis";
  }
}

export function modePlatform(mode: AppMode): Platform {
  switch (mode) {
    case "bumble-swipe":
      return "bumble";
    default:
      return "tinder";
  }
}

export function modeUsesSwipe(mode: AppMode): boolean {
  return mode !== "tinder-chat" && !modeUsesAnalysis(mode);
}

export function modeUsesChat(mode: AppMode): boolean {
  return mode === "tinder-chat" || mode === "tinder-swipe-chat";
}

export function modeUsesAnalysis(mode: AppMode): boolean {
  return mode === "tinder-analisis";
}

/** @deprecated use modeUsesAnalysis */
export function modeUsesScrape(mode: AppMode): boolean {
  return modeUsesAnalysis(mode);
}

export function modeNeedsOllama(_mode: AppMode): boolean {
  return true;
}

export function modeUsesChatBreaks(mode: AppMode): boolean {
  return mode === "tinder-swipe-chat";
}

export function modelsForMode(
  mode: AppMode,
  config: ResolvedAppConfig,
): string[] {
  const models = new Set<string>();

  if (modeUsesAnalysis(mode)) {
    models.add(config.ollama.chatModel);

    return [...models];
  }

  if (modeUsesSwipe(mode)) {
    models.add(config.ollama.swipeModel);
  }

  if (modeUsesChat(mode)) {
    models.add(config.ollama.chatModel);
  }

  return [...models];
}

export function buildChatSessionConfig(ai: AiConfigBundle): ChatSessionConfig {
  return {
    personaName: ai.chat.personaName,
    instagramHandle: ai.chat.instagramHandle,
    selfHandles: new Set(ai.chat.selfHandles.map((h) => h.toLowerCase())),
    instagramAskPattern: new RegExp(ai.chat.instagramAskPattern, "i"),
    systemConversations: new Set(
      ai.chat.systemConversations.map((n) => n.toLowerCase()),
    ),
    systemMessagePatterns: ai.chat.systemMessagePatterns.map(
      (p) => new RegExp(p, "i"),
    ),
  };
}
