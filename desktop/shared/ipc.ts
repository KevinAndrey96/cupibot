import type {
  AppMode,
  BootstrapProgress,
  LogEntry,
  RunCupiBotResult,
  SwipeProgress,
} from "./types.js";

export type {
  AppMode,
  BootstrapProgress,
  LogEntry,
  RunCupiBotResult,
  SwipeProgress,
} from "./types.js";

export const IPC_CHANNELS = {
  CONFIG_READ_ENV: "config:readEnv",
  CONFIG_WRITE_ENV: "config:writeEnv",
  CONFIG_READ_JSON: "config:readJson",
  CONFIG_WRITE_JSON: "config:writeJson",
  CONFIG_VALIDATE: "config:validate",
  CONFIG_SETUP: "config:setup",
  CONFIG_LIST_JSON: "config:listJson",
  DATA_LIST_CONVERSATIONS: "data:listConversations",
  DATA_READ_CONVERSATION: "data:readConversation",
  DATA_READ_HISTORICAL: "data:readHistorical",
  DATA_READ_INSTAGRAMS: "data:readInstagrams",
  DATA_READ_UNMATCHES: "data:readUnmatches",
  DATA_READ_RUNTIME_CONTEXT: "data:readRuntimeContext",
  DATA_READ_ANALYSIS: "data:readAnalysisReport",
  BOOTSTRAP_CHECK: "bootstrap:check",
  BOOTSTRAP_RUN: "bootstrap:run",
  BOOTSTRAP_PROGRESS: "bootstrap:progress",
  CUPIBOT_RUN: "cupibot:run",
  CUPIBOT_ABORT: "cupibot:abort",
  CUPIBOT_GET_DATA_DIR: "cupibot:getDataDir",
  CUPIBOT_LOG: "cupibot:log",
  CUPIBOT_PROGRESS: "cupibot:progress",
  CUPIBOT_COMPLETE: "cupibot:complete",
} as const;

export interface EnvVariable {
  key: string;
  value: string;
  comment?: string;
}

export interface ConfigJsonFile {
  relativePath: string;
  label: string;
}

export interface BootstrapStatus {
  chromium: boolean;
  ollama: boolean;
}

export interface ConversationListItem {
  fileName: string;
  name: string;
  platformId: string;
  messageCount: number;
}

export interface AnalysisReportData {
  markdown: string | null;
  metrics: unknown | null;
}

export interface CupiBotApi {
  getDataDir(): Promise<string>;
  readEnv(): Promise<EnvVariable[]>;
  writeEnv(variables: EnvVariable[]): Promise<void>;
  listJsonConfigs(): Promise<ConfigJsonFile[]>;
  readJson(relativePath: string): Promise<string>;
  writeJson(relativePath: string, content: string): Promise<void>;
  validateConfig(): Promise<{ ok: boolean; errors: string[] }>;
  setupConfig(): Promise<void>;
  listConversations(): Promise<ConversationListItem[]>;
  readConversation(fileName: string): Promise<unknown[]>;
  readHistorical(): Promise<unknown>;
  readInstagrams(): Promise<unknown[]>;
  readUnmatches(): Promise<unknown[]>;
  readRuntimeContext(): Promise<unknown[]>;
  readAnalysisReport(): Promise<AnalysisReportData>;
  checkBootstrap(): Promise<BootstrapStatus>;
  runBootstrap(): Promise<void>;
  runCupiBot(mode: AppMode): Promise<void>;
  abortCupiBot(): Promise<void>;
  onLog(callback: (entry: LogEntry) => void): () => void;
  onProgress(callback: (progress: SwipeProgress) => void): () => void;
  onBootstrapProgress(callback: (progress: BootstrapProgress) => void): () => void;
  onComplete(callback: (result: RunCupiBotResult) => void): () => void;
}

declare global {
  interface Window {
    cupibot: CupiBotApi;
  }
}
