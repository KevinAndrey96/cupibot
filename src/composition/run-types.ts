import type { AppMode } from "../config/app-config.js";
import type { BootstrapProgress } from "../infrastructure/bootstrap/bootstrap-progress.js";
import type { LogEntry } from "../infrastructure/logging/logger.js";
import type { SessionStatsWithBreakdown, SwipeProgress } from "../application/stats-tracker.js";
import type { AnalysisReport } from "../domain/types.js";

export type CupiBotExitReason =
  | "completed"
  | "aborted"
  | "ai_unavailable"
  | "out_of_likes"
  | "bootstrap_failed"
  | "fatal";

export interface RunCupiBotOptions {
  mode: AppMode;
  dataDir?: string;
  signal?: AbortSignal;
  onLog?: (entry: LogEntry) => void;
  onProgress?: (progress: SwipeProgress) => void;
  onBootstrapProgress?: (progress: BootstrapProgress) => void;
  skipBootstrap?: boolean;
  skipBanner?: boolean;
  keepOllamaAlive?: boolean;
}

export interface RunCupiBotResult {
  ok: boolean;
  reason: CupiBotExitReason;
  mode: AppMode;
  durationMs: number;
  stats?: SessionStatsWithBreakdown;
  chatSummary?: { cyclesCompleted: number; repliesSent: number };
  analysis?: AnalysisReport;
  conversationsSynced?: number;
  error?: { code: string; message: string; context?: string };
}
