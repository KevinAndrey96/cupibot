import path from "node:path";
import { resolveDataPath } from "../../config/data-dir.js";

export const OLLAMA_BINARIES = [
  "/usr/local/bin/ollama",
  "/opt/homebrew/bin/ollama",
  "/Applications/Ollama.app/Contents/Resources/ollama",
] as const;

export function getManagedOllamaDir(): string {
  return resolveDataPath("ollama");
}

export function getManagedOllamaBinaryPath(): string {
  if (process.platform === "win32") {
    return path.join(getManagedOllamaDir(), "ollama.exe");
  }

  if (process.platform === "darwin") {
    return path.join(
      getManagedOllamaDir(),
      "Ollama.app",
      "Contents",
      "Resources",
      "ollama",
    );
  }

  return path.join(getManagedOllamaDir(), "bin", "ollama");
}

export function getWindowsOllamaBinaryPaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    return [];
  }

  return [
    path.join(localAppData, "Programs", "Ollama", "ollama.exe"),
    path.join(getManagedOllamaDir(), "ollama.exe"),
  ];
}
