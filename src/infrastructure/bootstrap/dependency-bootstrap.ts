import {
  ensureOllamaInstalled,
} from "./ollama-installer.js";
import {
  installChromium,
  isChromiumInstalled,
} from "./playwright-bootstrap.js";
import { loadAppConfig } from "../../config/app-config.js";
import { OllamaManager } from "../ai/ollama-manager.js";
import {
  BOOTSTRAP_PERCENT,
  bootstrapProgress,
  type BootstrapProgressCallback,
} from "./bootstrap-progress.js";

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapError";
  }
}

export async function runDependencyBootstrap(
  onProgress?: BootstrapProgressCallback,
): Promise<void> {
  console.log("[Bootstrap] checking runtime dependencies...");
  onProgress?.(bootstrapProgress(
    "checking",
    "Verificando dependencias...",
    0,
  ));

  await ensureChromium(onProgress);
  await ensureOllamaCli(onProgress);
  await ensureOllamaServer(onProgress);

  onProgress?.(bootstrapProgress(
    "complete",
    "Dependencias listas",
    BOOTSTRAP_PERCENT.complete,
  ));

  console.log("[Bootstrap] runtime dependencies ready");
}

async function ensureChromium(onProgress?: BootstrapProgressCallback): Promise<void> {
  if (isChromiumInstalled()) {
    console.log("[Bootstrap] Playwright Chromium: installed");
    onProgress?.(bootstrapProgress(
      "chromium",
      "Chromium ya instalado",
      BOOTSTRAP_PERCENT.chromiumDone,
    ));

    return;
  }

  console.log("[Bootstrap] Playwright Chromium: missing - downloading...");
  console.log("[Bootstrap] this may take a few minutes on first run...");
  onProgress?.(bootstrapProgress(
    "chromium",
    "Descargando Chromium de Playwright...",
    null,
  ));

  try {
    await installChromium();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    throw new BootstrapError(
      `playwright chromium install failed: ${detail}`,
    );
  }

  if (!isChromiumInstalled()) {
    throw new BootstrapError(
      "playwright chromium install finished but browser is still missing",
    );
  }

  console.log("[Bootstrap] Playwright Chromium: ready");
  onProgress?.(bootstrapProgress(
    "chromium",
    "Chromium listo",
    BOOTSTRAP_PERCENT.chromiumDone,
  ));
}

async function ensureOllamaCli(onProgress?: BootstrapProgressCallback): Promise<void> {
  try {
    await ensureOllamaInstalled({
      onStatus: (message) => {
        console.log(`[Bootstrap] ${message}`);
      },
      onProgress,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    throw new BootstrapError(`ollama install failed: ${detail}`);
  }
}

async function ensureOllamaServer(onProgress?: BootstrapProgressCallback): Promise<void> {
  const appConfig = loadAppConfig();
  const baseUrl = appConfig.ollama.url;

  onProgress?.(bootstrapProgress(
    "ollama-server",
    "Arrancando servidor Ollama...",
    BOOTSTRAP_PERCENT.ollamaServer,
  ));

  try {
    const manager = new OllamaManager(baseUrl);

    await manager.startServer();
    console.log(`[Bootstrap] Ollama server: ${baseUrl}`);
    onProgress?.(bootstrapProgress(
      "ollama-server",
      "Servidor Ollama en marcha",
      BOOTSTRAP_PERCENT.complete,
    ));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    throw new BootstrapError(`ollama server start failed: ${detail}`);
  }
}
