import {
  loadAppConfig,
  modeLabel,
  modeNeedsOllama,
  modePlatform,
  modelsForMode,
  modeUsesAnalysis,
  modeUsesChat,
  modeUsesChatBreaks,
  modeUsesSwipe,
} from "../config/app-config.js";
import { setDataDir } from "../config/data-dir.js";
import { reloadEnv } from "../config/env.js";
import { clearShutdownHandlers, registerShutdownHandler } from "../application/shutdown-coordinator.js";
import {
  formatAiFailure,
  isAiConsultationError,
  isOllamaConnectionError,
  toAiFailure,
  AiConsultationError,
} from "../infrastructure/ai/ai-error.js";
import { OllamaManager } from "../infrastructure/ai/ollama-manager.js";
import { BrowserManager } from "../infrastructure/browser/browser-manager.js";
import {
  BootstrapError,
  runDependencyBootstrap,
} from "../infrastructure/bootstrap/dependency-bootstrap.js";
import { setLogSink } from "../infrastructure/logging/logger.js";
import { createAnalysisSession, createChatSession } from "./create-sessions.js";
import { createSwipePage } from "./create-pages.js";
import { runChatSession, runSwipeSession } from "./run-mode.js";
import type { RunCupiBotOptions, RunCupiBotResult } from "./run-types.js";
import { wireAbortSignal } from "./wire-abort.js";

export async function runCupiBot(options: RunCupiBotOptions): Promise<RunCupiBotResult> {
  const startedAt = Date.now();
  const {
    mode,
    signal,
    onLog,
    onProgress,
    onBootstrapProgress,
    skipBootstrap = false,
    keepOllamaAlive = false,
  } = options;

  if (options.dataDir) {
    setDataDir(options.dataDir);
    reloadEnv();
  }

  clearShutdownHandlers();

  if (onLog) {
    setLogSink(onLog, false);
  } else {
    setLogSink(null);
  }

  try {
    if (!skipBootstrap) {
      await runDependencyBootstrap(onBootstrapProgress);
    }
  } catch (error) {
    const message = error instanceof BootstrapError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);

    console.error(`[Bootstrap] setup failed: ${message}`);

    return {
      ok: false,
      reason: "bootstrap_failed",
      mode,
      durationMs: Date.now() - startedAt,
      error: { code: "BootstrapError", message },
    };
  }

  const appConfig = loadAppConfig();
  const platform = modePlatform(mode);
  const label = modeLabel(mode);

  console.log(`[CupiBot] Mode: ${label}`);

  const ollamaManager = modeNeedsOllama(mode)
    ? new OllamaManager(appConfig.ollama.url)
    : null;

  if (ollamaManager) {
    console.log(`[CupiBot] AI server: ${appConfig.ollama.url}`);

    try {
      await ollamaManager.startServer();
    } catch (error) {
      const aiError = error instanceof AiConsultationError
        ? error
        : new AiConsultationError("ollama serve", error);

      return {
        ok: false,
        reason: "ai_unavailable",
        mode,
        durationMs: Date.now() - startedAt,
        error: formatAiFailure(aiError),
      };
    }

    console.log(`[CupiBot] Swipe model: ${appConfig.ollama.swipeModel}`);
    console.log(`[CupiBot] Chat model: ${appConfig.ollama.chatModel}`);

    try {
      await ollamaManager.ensureReady(modelsForMode(mode, appConfig));
    } catch (error) {
      const aiError = error instanceof AiConsultationError
        ? error
        : new AiConsultationError("AI startup", error);

      return {
        ok: false,
        reason: "ai_unavailable",
        mode,
        durationMs: Date.now() - startedAt,
        error: formatAiFailure(aiError),
      };
    }
  }

  const browserManager = new BrowserManager(appConfig.browser.headless, platform);

  try {
    const { page } = await browserManager.launch();

    wireAbortSignal(signal, [
      () => {
        void browserManager.close();
      },
    ]);

    const swipePage = createSwipePage(platform, page);

    console.log(`[CupiBot] navigating to ${platform}...`);
    await swipePage.navigate();
    console.log("[CupiBot] log in manually in the browser window if needed");

    if (modeUsesAnalysis(mode)) {
      await ollamaManager!.activate(appConfig.ollama.chatModel);
      const session = createAnalysisSession(page, platform, appConfig);
      wireAbortSignal(signal, [() => session.abort()]);
      registerShutdownHandler(() => session.abort());

      const analysisResult = await session.run();

      return {
        ok: true,
        reason: signal?.aborted ? "aborted" : "completed",
        mode,
        durationMs: Date.now() - startedAt,
        analysis: analysisResult.report ?? undefined,
        conversationsSynced: analysisResult.conversationsSynced,
      };
    }

    if (modeUsesSwipe(mode)) {
      await ollamaManager!.activate(appConfig.ollama.swipeModel);

      const swipeResult = await runSwipeSession(
        page,
        platform,
        modeUsesChatBreaks(mode),
        appConfig,
        ollamaManager!,
        onProgress,
        signal,
      );

      return {
        ok: swipeResult.reason !== "ai_unavailable",
        reason: swipeResult.reason,
        mode,
        durationMs: Date.now() - startedAt,
        stats: swipeResult.stats,
        error: swipeResult.reason === "ai_unavailable"
          ? { code: "AiConsultationError", message: "AI unavailable during swipe session" }
          : undefined,
      };
    }

    if (modeUsesChat(mode) && !modeUsesChatBreaks(mode)) {
      const chatSession = createChatSession(page, platform, appConfig);
      wireAbortSignal(signal, [() => chatSession.abort()]);

      const chatResult = await runChatSession(page, platform, appConfig, ollamaManager!);

      return {
        ok: true,
        reason: chatResult.reason,
        mode,
        durationMs: Date.now() - startedAt,
        chatSummary: chatResult.chatSummary,
      };
    }

    return {
      ok: true,
      reason: "completed",
      mode,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (signal?.aborted) {
      return {
        ok: true,
        reason: "aborted",
        mode,
        durationMs: Date.now() - startedAt,
      };
    }

    if (isAiConsultationError(error) || isOllamaConnectionError(error)) {
      return {
        ok: false,
        reason: "ai_unavailable",
        mode,
        durationMs: Date.now() - startedAt,
        error: formatAiFailure(toAiFailure(error, "session")),
      };
    }

    return {
      ok: false,
      reason: "fatal",
      mode,
      durationMs: Date.now() - startedAt,
      error: formatAiFailure(error),
    };
  } finally {
    await browserManager.close();

    if (ollamaManager) {
      if (keepOllamaAlive) {
        await ollamaManager.releaseModels();
      } else {
        await ollamaManager.shutdown();
      }
    }

    clearShutdownHandlers();
    setLogSink(null);
  }
}
