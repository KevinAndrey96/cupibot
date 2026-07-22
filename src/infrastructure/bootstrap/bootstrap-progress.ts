export type BootstrapStep =
  | "checking"
  | "chromium"
  | "ollama-download"
  | "ollama-extract"
  | "ollama-install"
  | "ollama-server"
  | "complete";

export interface BootstrapProgress {
  step: BootstrapStep;
  message: string;
  percent: number | null;
}

export type BootstrapProgressCallback = (progress: BootstrapProgress) => void;

const CHROMIUM_WEIGHT = 35;
const OLLAMA_DOWNLOAD_START = CHROMIUM_WEIGHT;
const OLLAMA_DOWNLOAD_SPAN = 55;
const OLLAMA_EXTRACT_PERCENT = 92;
const OLLAMA_SERVER_PERCENT = 97;

export function bootstrapProgress(
  step: BootstrapStep,
  message: string,
  percent: number | null,
): BootstrapProgress {
  return { step, message, percent };
}

export function mapOllamaDownloadPercent(downloadPercent: number): number {
  const clamped = Math.max(0, Math.min(100, downloadPercent));

  return OLLAMA_DOWNLOAD_START + Math.round((clamped * OLLAMA_DOWNLOAD_SPAN) / 100);
}

export const BOOTSTRAP_PERCENT = {
  chromiumDone: CHROMIUM_WEIGHT,
  ollamaExtract: OLLAMA_EXTRACT_PERCENT,
  ollamaServer: OLLAMA_SERVER_PERCENT,
  complete: 100,
} as const;

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
