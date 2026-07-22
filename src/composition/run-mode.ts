import type { Page } from "playwright";
import { MatchHandler } from "../application/match-handler.js";
import { StatsTracker, type SessionStatsWithBreakdown, type SwipeProgress } from "../application/stats-tracker.js";
import { SwipeSession } from "../application/swipe-session.js";
import {
  buildSessionConfig,
  type ResolvedAppConfig,
} from "../config/app-config.js";
import { loadAiConfig, resolveAiLanguage } from "../config/ai-config.js";
import { DelayCalculator } from "../domain/delay-calculator.js";
import type { OllamaManagerPort, Platform } from "../domain/types.js";
import { ProfileClassifier } from "../infrastructure/ai/profile-classifier.js";
import { isAiConsultationError } from "../infrastructure/ai/ai-error.js";
import { registerShutdownHandler } from "../application/shutdown-coordinator.js";
import { createChatSession } from "./create-sessions.js";
import { createSwipePage } from "./create-pages.js";
import type { CupiBotExitReason } from "./run-types.js";
import { wireAbortSignal } from "./wire-abort.js";

export async function runSwipeSession(
  page: Page,
  platform: Platform,
  withChatBreaks: boolean,
  appConfig: ResolvedAppConfig,
  ollamaManager: OllamaManagerPort,
  onProgress?: (progress: SwipeProgress) => void,
  signal?: AbortSignal,
): Promise<{ reason: CupiBotExitReason; stats: SessionStatsWithBreakdown }> {
  const aiConfig = loadAiConfig();
  const sessionConfig = buildSessionConfig(
    appConfig,
    platform,
    aiConfig.beautyFilter.minScore,
  );
  const swipePage = createSwipePage(platform, page);
  const statsTracker = new StatsTracker();

  if (onProgress) {
    statsTracker.setProgressCallback(onProgress);
  }

  await ollamaManager.activate(appConfig.ollama.swipeModel);

  const onSwipeScreen = await swipePage.isOnSwipeScreen();

  if (!onSwipeScreen) {
    console.log("[CupiBot] warning: swipe screen not detected, proceeding anyway");
  } else {
    console.log("[CupiBot] swipe screen detected");
  }

  const delayCalculator = new DelayCalculator(
    sessionConfig.minDelayMs,
    sessionConfig.maxDelayMs,
    sessionConfig.batchPauseMinMs,
    sessionConfig.batchPauseMaxMs,
    sessionConfig.batchSizeMin,
    sessionConfig.batchSizeMax,
    sessionConfig.viewingDelayMaxMs,
    sessionConfig.restBreakMinMs,
    sessionConfig.restBreakMaxMs,
  );

  const classifier = new ProfileClassifier(
    appConfig.ollama.url,
    appConfig.ollama.swipeModel,
    aiConfig,
  );

  console.log(
    `[CupiBot] AI language: ${resolveAiLanguage()} | filters: gender=${aiConfig.genderFilter.enabled ? "on" : "off"} | ` +
      `beauty=${aiConfig.beautyFilter.enabled ? "on" : "off"} ` +
      `(min score: ${aiConfig.beautyFilter.minScore})`,
  );
  console.log(`[CupiBot] session target: ${sessionConfig.maxSwipes} swipes`);

  const chatBreak = withChatBreaks ? createChatSession(page, platform, appConfig) : null;
  const sendOpenerOnMatch = appConfig.swipe.sendOpenerOnMatch[platform];

  const matchHandler = new MatchHandler(
    swipePage,
    statsTracker,
    classifier,
    aiConfig.openers,
    sendOpenerOnMatch,
  );

  const onChatBreakStart = withChatBreaks
    ? () => ollamaManager.activate(appConfig.ollama.chatModel)
    : null;
  const onChatBreakEnd = withChatBreaks
    ? () => ollamaManager.activate(appConfig.ollama.swipeModel)
    : null;

  const session = new SwipeSession(
    swipePage,
    delayCalculator,
    matchHandler,
    statsTracker,
    sessionConfig,
    classifier,
    chatBreak,
    onChatBreakStart,
    onChatBreakEnd,
  );

  wireAbortSignal(signal, [
    () => session.abort(),
    () => chatBreak?.abort(),
  ]);

  registerShutdownHandler(() => {
    session.abort();
    chatBreak?.abort();
    statsTracker.printSummary();
  });

  try {
    const swipeResult = await session.run();
    statsTracker.finish();

    const reason: CupiBotExitReason = swipeResult.reason === "out_of_likes"
      ? "out_of_likes"
      : swipeResult.reason === "aborted"
        ? "aborted"
        : "completed";

    return { reason, stats: statsTracker.fullSummary() };
  } catch (error) {
    if (isAiConsultationError(error)) {
      statsTracker.recordError();
      statsTracker.finish();
      console.error(`[CupiBot] AI unavailable, ending session: ${error.message}`);

      return { reason: "ai_unavailable", stats: statsTracker.fullSummary() };
    }

    throw error;
  }
}

export async function runChatSession(
  page: Page,
  platform: Platform,
  appConfig: ResolvedAppConfig,
  ollamaManager: OllamaManagerPort,
): Promise<{ reason: CupiBotExitReason; chatSummary: { cyclesCompleted: number; repliesSent: number } }> {
  await ollamaManager.activate(appConfig.ollama.chatModel);

  const session = createChatSession(page, platform, appConfig);

  registerShutdownHandler(() => {
    session.abort();
  });

  const result = await session.run();

  return {
    reason: result.reason === "aborted" ? "aborted" : "completed",
    chatSummary: {
      cyclesCompleted: result.cyclesCompleted,
      repliesSent: result.repliesSent,
    },
  };
}
