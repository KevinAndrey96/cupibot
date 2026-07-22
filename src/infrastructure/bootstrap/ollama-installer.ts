import { access, chmod, mkdir, rm } from "node:fs/promises";
import { constants, createWriteStream } from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import {
  commandExists,
  locateOllamaBinary,
} from "./ollama-binary-locator.js";
import {
  getManagedOllamaBinaryPath,
  getManagedOllamaDir,
} from "./ollama-paths.js";
import {
  BOOTSTRAP_PERCENT,
  bootstrapProgress,
  formatByteSize,
  mapOllamaDownloadPercent,
  type BootstrapProgressCallback,
} from "./bootstrap-progress.js";

const MAC_DOWNLOAD_URL = "https://ollama.com/download/Ollama-darwin.zip";
const WIN_DOWNLOAD_URL = "https://ollama.com/download/OllamaSetup.exe";

export {
  getManagedOllamaDir,
  getManagedOllamaBinaryPath,
} from "./ollama-paths.js";

export interface EnsureOllamaInstalledOptions {
  onStatus?: (message: string) => void;
  onProgress?: BootstrapProgressCallback;
}

export async function ensureOllamaInstalled(
  options: EnsureOllamaInstalledOptions = {},
): Promise<string> {
  const { onStatus, onProgress } = options;

  const log = (message: string) => {
    onStatus?.(message);
    console.log(`[Bootstrap] ${message}`);
  };

  const existing = await locateOllamaBinary();

  if (existing) {
    log(`Ollama CLI: ${existing}`);

    return existing;
  }

  if (process.platform === "darwin" && (await commandExists("brew"))) {
    log("Ollama CLI: missing - installing via Homebrew...");
    onProgress?.(bootstrapProgress(
      "ollama-install",
      "Instalando Ollama con Homebrew...",
      null,
    ));

    try {
      await runCommand("brew", ["install", "ollama"]);
      const brewBinary = await locateOllamaBinary();

      if (brewBinary) {
        log(`Ollama CLI: ${brewBinary}`);
        onProgress?.(bootstrapProgress(
          "ollama-install",
          "Ollama instalado",
          BOOTSTRAP_PERCENT.ollamaExtract,
        ));

        return brewBinary;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      log(`Homebrew install failed, falling back to managed install: ${detail}`);
    }
  }

  log("Ollama CLI: downloading managed copy (no manual install required)...");

  if (process.platform === "darwin") {
    await installOllamaMacManaged(log, onProgress);
  } else if (process.platform === "win32") {
    await installOllamaWindowsManaged(log, onProgress);
  } else {
    await installOllamaLinuxManaged(log, onProgress);
  }

  const binary = await locateOllamaBinary();

  if (!binary) {
    throw new Error("ollama install finished but binary is still missing");
  }

  log(`Ollama CLI: ${binary}`);

  return binary;
}

async function installOllamaMacManaged(
  log: (message: string) => void,
  onProgress?: BootstrapProgressCallback,
): Promise<void> {
  const managedDir = getManagedOllamaDir();
  const zipPath = path.join(managedDir, "Ollama-darwin.zip");

  await mkdir(managedDir, { recursive: true });
  await downloadFile(MAC_DOWNLOAD_URL, zipPath, {
    log,
    onProgress: (received, total) => {
      reportDownloadProgress(onProgress, received, total);
    },
  });

  onProgress?.(bootstrapProgress(
    "ollama-extract",
    "Extrayendo Ollama...",
    BOOTSTRAP_PERCENT.ollamaExtract,
  ));
  log("Extracting Ollama for macOS...");

  await runCommand("unzip", ["-oq", zipPath, "-d", managedDir]);
  await chmod(getManagedOllamaBinaryPath(), 0o755);
  await rm(zipPath, { force: true });
}

async function installOllamaWindowsManaged(
  log: (message: string) => void,
  onProgress?: BootstrapProgressCallback,
): Promise<void> {
  const managedDir = getManagedOllamaDir();
  const installerPath = path.join(managedDir, "OllamaSetup.exe");

  await mkdir(managedDir, { recursive: true });
  await downloadFile(WIN_DOWNLOAD_URL, installerPath, {
    log,
    onProgress: (received, total) => {
      reportDownloadProgress(onProgress, received, total);
    },
  });

  onProgress?.(bootstrapProgress(
    "ollama-install",
    "Ejecutando instalador de Ollama...",
    BOOTSTRAP_PERCENT.ollamaExtract,
  ));
  log("Running Ollama Windows installer...");

  await runCommand(installerPath, [
    "/SP-",
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    `/DIR=${managedDir}`,
  ]);

  await rm(installerPath, { force: true });
}

async function installOllamaLinuxManaged(
  log: (message: string) => void,
  onProgress?: BootstrapProgressCallback,
): Promise<void> {
  onProgress?.(bootstrapProgress(
    "ollama-install",
    "Instalando Ollama en Linux...",
    null,
  ));
  log("Installing Ollama via official install script...");

  await runCommand("sh", ["-c", "curl -fsSL https://ollama.com/install.sh | sh"]);
  onProgress?.(bootstrapProgress(
    "ollama-install",
    "Ollama instalado",
    BOOTSTRAP_PERCENT.ollamaExtract,
  ));
}

function reportDownloadProgress(
  onProgress: BootstrapProgressCallback | undefined,
  received: number,
  total: number,
): void {
  if (!onProgress) {
    return;
  }

  if (total > 0) {
    const downloadPercent = Math.min(100, Math.round((received / total) * 100));
    const overallPercent = mapOllamaDownloadPercent(downloadPercent);

    onProgress(bootstrapProgress(
      "ollama-download",
      `Descargando Ollama... ${downloadPercent}% (${formatByteSize(received)} / ${formatByteSize(total)})`,
      overallPercent,
    ));

    return;
  }

  onProgress(bootstrapProgress(
    "ollama-download",
    `Descargando Ollama... ${formatByteSize(received)}`,
    null,
  ));
}

interface DownloadFileOptions {
  log?: (message: string) => void;
  onProgress?: (received: number, total: number) => void;
}

async function downloadFile(
  url: string,
  dest: string,
  options: DownloadFileOptions = {},
): Promise<void> {
  const { log, onProgress } = options;

  log?.(`Downloading ${url}...`);

  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(`download failed (${response.status}) for ${url}`);
  }

  const total = Number(response.headers.get("content-length") ?? 0);
  let received = 0;

  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      onProgress?.(received, total);
      callback(null, chunk);
    },
  });

  const body = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);

  await pipeline(body, counter, createWriteStream(dest));
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (error) => {
      reject(new Error(`${command}: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

export async function isManagedOllamaInstalled(): Promise<boolean> {
  try {
    await access(getManagedOllamaBinaryPath(), constants.X_OK);

    return true;
  } catch {
    return false;
  }
}
