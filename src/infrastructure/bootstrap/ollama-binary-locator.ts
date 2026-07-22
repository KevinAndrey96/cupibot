import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  getManagedOllamaBinaryPath,
  getWindowsOllamaBinaryPaths,
  OLLAMA_BINARIES,
} from "./ollama-paths.js";

const execFileAsync = promisify(execFile);

export { OLLAMA_BINARIES } from "./ollama-paths.js";
export {
  getManagedOllamaDir,
  getManagedOllamaBinaryPath,
} from "./ollama-paths.js";

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);

    return true;
  } catch {
    return false;
  }
}

export async function locateOllamaBinary(): Promise<string | null> {
  const managed = getManagedOllamaBinaryPath();

  if (await isExecutable(managed)) {
    return managed;
  }

  if (process.platform === "win32") {
    for (const candidate of getWindowsOllamaBinaryPaths()) {
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(whichCmd, ["ollama"]);
    const fromPath = stdout.trim().split(/\r?\n/)[0];

    if (fromPath && await isExecutable(fromPath)) {
      return fromPath;
    }
  } catch {
    // fall through to known install paths
  }

  for (const candidate of OLLAMA_BINARIES) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(whichCmd, [command]);

    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}
