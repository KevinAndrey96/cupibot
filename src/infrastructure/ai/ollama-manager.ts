import { spawn, type ChildProcess } from "node:child_process";
import { modelIsInstalled, parseOllamaHost } from "./ollama-model-utils.js";
import { locateOllamaBinary } from "../bootstrap/ollama-binary-locator.js";
import type { OllamaManagerPort } from "../../domain/types.js";

const HEALTH_POLL_MS = 500;
const STARTUP_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 120_000;

interface TagsResponse {
  models: Array<{ name: string }>;
}

interface GenerateResponse {
  response: string;
}

export class OllamaManager implements OllamaManagerPort {
  private process: ChildProcess | null = null;
  private startedByUs = false;
  private activeModel: string | null = null;
  private serverReady = false;
  private readonly ollamaHost: string;
  private ollamaBinary: string | null = null;

  constructor(private readonly baseUrl: string) {
    this.ollamaHost = parseOllamaHost(baseUrl);
  }

  async ensureReady(models: string[]): Promise<void> {
    await this.startServer();
    await this.ensureModelsAvailable(models);

    console.log("[AI] Ollama ready");
  }

  async startServer(): Promise<void> {
    if (this.serverReady) {
      return;
    }

    if (await this.isHealthy()) {
      console.log(`[AI] Ollama server already running at ${this.baseUrl}`);
      this.serverReady = true;

      return;
    }

    const binary = await this.resolveOllamaBinary();

    console.log(`[AI] Ollama not running - starting: ${binary} serve`);
    console.log(`[AI] OLLAMA_HOST=${this.ollamaHost}`);

    await this.spawnServer(binary);
    this.serverReady = true;
    console.log(`[AI] Ollama server started at ${this.baseUrl}`);
  }

  async activate(model: string): Promise<void> {
    if (this.activeModel === model) {
      return;
    }

    if (this.activeModel) {
      await this.unload(this.activeModel);
    }

    console.log(`[AI] loading model: ${model}`);
    await this.warmup(model);
    this.activeModel = model;
    console.log(`[AI] model active: ${model}`);
  }

  async shutdown(): Promise<void> {
    await this.releaseModels();

    if (this.startedByUs && this.process) {
      console.log("[AI] stopping Ollama server (started by bot)");
      this.process.kill("SIGTERM");
      this.process = null;
      this.startedByUs = false;
      this.serverReady = false;
    }
  }

  async releaseModels(): Promise<void> {
    if (this.activeModel) {
      await this.unload(this.activeModel);
      this.activeModel = null;
    }
  }

  private async spawnServer(binary: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const stderrChunks: string[] = [];

      const fail = (error: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      };

      const succeed = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        resolve();
      };

      const proc = spawn(binary, ["serve"], {
        stdio: ["ignore", "ignore", "pipe"],
        detached: false,
        env: {
          ...process.env,
          OLLAMA_HOST: this.ollamaHost,
        },
      });

      this.process = proc;
      this.startedByUs = true;

      proc.stderr?.on("data", (chunk: Buffer) => {
        const line = chunk.toString().trim();

        if (line) {
          stderrChunks.push(line);
        }
      });

      proc.on("error", (error) => {
        fail(
          new Error(
            `ollama serve: ${error.message} - reinstall dependencies from Setup`,
          ),
        );
      });

      proc.on("exit", (code) => {
        if (code !== null && code !== 0 && this.startedByUs && !settled) {
          const detail = stderrChunks.length > 0
            ? stderrChunks.join(" | ")
            : "no stderr output";

          fail(new Error(`ollama serve exited with code ${code}: ${detail}`));
        }
      });

      this.waitForHealthy()
        .then(succeed)
        .catch((error) => {
          const detail = stderrChunks.length > 0
            ? `${error instanceof Error ? error.message : error} | stderr: ${stderrChunks.join(" | ")}`
            : error;

          fail(detail instanceof Error ? detail : new Error(String(detail)));
        });
    });
  }

  private async resolveOllamaBinary(): Promise<string> {
    if (this.ollamaBinary) {
      return this.ollamaBinary;
    }

    const binary = await locateOllamaBinary();

    if (!binary) {
      throw new Error(
        "ollama CLI not found - run dependency bootstrap to install it automatically",
      );
    }

    this.ollamaBinary = binary;

    return binary;
  }

  private spawnEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      OLLAMA_HOST: this.ollamaHost,
    };
  }

  private async ensureModelsAvailable(models: string[]): Promise<void> {
    const installed = await this.listInstalledModels();
    const unique = [...new Set(models)];
    const binary = await this.resolveOllamaBinary();

    for (const model of unique) {
      if (modelIsInstalled(model, installed)) {
        console.log(`[AI] model available: ${model}`);
        continue;
      }

      console.log(`[AI] model missing, downloading: ${model}`);
      console.log(`[AI] this may take several minutes on first run...`);
      await this.pullModel(binary, model);
      console.log(`[AI] download complete: ${model}`);
    }
  }

  private async pullModel(binary: string, model: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const pull = spawn(binary, ["pull", model], {
        stdio: "inherit",
        env: this.spawnEnv(),
      });

      pull.on("error", (error) => {
        reject(new Error(`ollama pull ${model}: ${error.message}`));
      });

      pull.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`ollama pull ${model} exited with code ${code}`));
      });
    });
  }

  private async listInstalledModels(): Promise<string[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`);

      if (!response.ok) {
        throw new Error(`ollama tags request failed with status ${response.status}`);
      }

      const data = (await response.json()) as TagsResponse;

      return data.models.map((m) => m.name);
    } catch (error) {
      throw new Error(
        `ollama tags at ${this.baseUrl}: ${error instanceof Error ? error.message : error}`,
        { cause: error },
      );
    }
  }

  private async warmup(model: string): Promise<void> {
    await this.generate(model, "ok", {
      numPredict: 1,
      keepAlive: "10m",
    });
  }

  private async unload(model: string): Promise<void> {
    try {
      await this.generate(model, "ok", {
        numPredict: 1,
        keepAlive: "0",
      });
    } catch (error) {
      console.error(
        `[AI] unload ${model}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async generate(
    model: string,
    prompt: string,
    options: { numPredict: number; keepAlive: string },
  ): Promise<void> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        keep_alive: options.keepAlive,
        options: { num_predict: options.numPredict },
      }),
    });

    if (!response.ok) {
      throw new Error(`ollama generate for ${model} failed with status ${response.status}`);
    }

    await response.json() as GenerateResponse;
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
        method: "GET",
      }, 3_000);

      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitForHealthy(): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (await this.isHealthy()) {
        return;
      }

      await sleep(HEALTH_POLL_MS);
    }

    throw new Error(
      `ollama server did not become ready within ${STARTUP_TIMEOUT_MS / 1000}s - check OLLAMA_URL (${this.baseUrl})`,
    );
  }

  private fetchWithTimeout(
    url: string,
    init?: RequestInit,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
