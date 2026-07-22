import type { Platform } from "../domain/types.js";
import { setDataDir } from "../config/data-dir.js";
import { reloadEnv } from "../config/env.js";
import { BrowserManager } from "../infrastructure/browser/browser-manager.js";
import {
  BootstrapError,
  runDependencyBootstrap,
} from "../infrastructure/bootstrap/dependency-bootstrap.js";
import { setLogSink } from "../infrastructure/logging/logger.js";
import type { BootstrapProgress } from "../infrastructure/bootstrap/bootstrap-progress.js";
import type { LogEntry } from "../infrastructure/logging/logger.js";
import { createSwipePage } from "./create-pages.js";
import { wireAbortSignal } from "./wire-abort.js";

export interface RunBrowserLoginOptions {
  platform: Platform;
  dataDir?: string;
  signal?: AbortSignal;
  onLog?: (entry: LogEntry) => void;
  onBootstrapProgress?: (progress: BootstrapProgress) => void;
  skipBootstrap?: boolean;
}

export interface RunBrowserLoginResult {
  ok: boolean;
  platform: Platform;
  reason: "completed" | "aborted" | "bootstrap_failed";
  error?: { code: string; message: string };
}

function waitForAbort(signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return Promise.resolve();
  }

  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

export async function runBrowserLogin(
  options: RunBrowserLoginOptions,
): Promise<RunBrowserLoginResult> {
  const {
    platform,
    signal,
    onLog,
    onBootstrapProgress,
    skipBootstrap = false,
  } = options;

  if (options.dataDir) {
    setDataDir(options.dataDir);
    reloadEnv();
  }

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

    return {
      ok: false,
      platform,
      reason: "bootstrap_failed",
      error: { code: "BootstrapError", message },
    };
  }

  const browserManager = new BrowserManager(false, platform);

  try {
    const { page } = await browserManager.launch();

    wireAbortSignal(signal, [
      () => {
        void browserManager.close();
      },
    ]);

    const swipePage = createSwipePage(platform, page);

    console.log(`[CupiBot] opening ${platform} for manual login`);
    await swipePage.navigate();
    console.log("[CupiBot] log in manually in the browser window");
    console.log("[CupiBot] press Listo in the app when you finish");

    await waitForAbort(signal);

    return {
      ok: true,
      platform,
      reason: signal?.aborted ? "aborted" : "completed",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      platform,
      reason: "bootstrap_failed",
      error: { code: "BrowserLoginError", message },
    };
  } finally {
    await browserManager.close();
    setLogSink(null);
  }
}
