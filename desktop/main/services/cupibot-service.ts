import type { BrowserWindow } from "electron";
import type { AppMode } from "../../shared/types.js";
import { runCupiBot } from "../../../src/cupibot-runner.js";
import { isChromiumInstalled } from "../../../src/infrastructure/bootstrap/playwright-bootstrap.js";
import { locateOllamaBinary } from "../../../src/infrastructure/bootstrap/ollama-binary-locator.js";
import { runDependencyBootstrap } from "../../../src/infrastructure/bootstrap/dependency-bootstrap.js";
import type { BootstrapProgress, LogEntry, RunCupiBotResult, SwipeProgress } from "../../shared/types.js";
import type { BootstrapStatus } from "../../shared/ipc.js";
import { IPC_CHANNELS } from "../../shared/ipc.js";
import { getCupiBotDataDir } from "../data-path.js";

export class CupiBotService {
  private abortController: AbortController | null = null;
  private running = false;
  private bootstrapPromise: Promise<void> | null = null;
  private bootstrapReady = false;

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  getDataDir(): string {
    return getCupiBotDataDir();
  }

  async checkBootstrap(): Promise<BootstrapStatus> {
    const ollama = (await locateOllamaBinary()) !== null;

    return {
      chromium: isChromiumInstalled(),
      ollama,
    };
  }

  async runBootstrap(): Promise<void> {
    if (this.bootstrapPromise) {
      await this.bootstrapPromise;

      return;
    }

    this.bootstrapPromise = runDependencyBootstrap((progress) => {
      this.emitBootstrapProgress(progress);
    });

    try {
      await this.bootstrapPromise;
      this.bootstrapReady = true;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  async run(mode: AppMode): Promise<RunCupiBotResult> {
    if (this.running) {
      throw new Error("cupibot is already running");
    }

    this.running = true;
    this.abortController = new AbortController();
    const window = this.getWindow();

    const emitLog = (entry: LogEntry) => {
      window?.webContents.send(IPC_CHANNELS.CUPIBOT_LOG, {
        ...entry,
        ts: entry.ts.toISOString(),
      });
    };

    const emitProgress = (progress: SwipeProgress) => {
      window?.webContents.send(IPC_CHANNELS.CUPIBOT_PROGRESS, progress);
    };

    const emitBootstrapProgress = (progress: BootstrapProgress) => {
      this.emitBootstrapProgress(progress);
    };

    try {
      const result = await runCupiBot({
        mode,
        dataDir: getCupiBotDataDir(),
        signal: this.abortController.signal,
        onLog: emitLog,
        onProgress: emitProgress,
        onBootstrapProgress: emitBootstrapProgress,
        skipBootstrap: this.bootstrapReady,
        keepOllamaAlive: true,
      });

      window?.webContents.send(IPC_CHANNELS.CUPIBOT_COMPLETE, result);

      return result;
    } finally {
      this.running = false;
      this.abortController = null;
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  private emitBootstrapProgress(progress: BootstrapProgress): void {
    this.getWindow()?.webContents.send(IPC_CHANNELS.BOOTSTRAP_PROGRESS, progress);
  }
}
