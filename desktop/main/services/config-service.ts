import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { loadAiConfig } from "../../../src/config/ai-config.js";
import { loadAnalysisConfig } from "../../../src/config/analysis-config.js";
import { loadAppConfig, buildSessionConfig } from "../../../src/config/app-config.js";
import { setDataDir } from "../../../src/config/data-dir.js";
import { reloadEnv } from "../../../src/config/env.js";
import type { ConfigJsonFile, EnvVariable } from "../../shared/ipc.js";
import { assertAllowedRelativePath } from "../../shared/path-safety.js";
import { ensureDataDir, getCupiBotDataDir, resolveDataFile } from "../data-path.js";

const JSON_CONFIGS: ConfigJsonFile[] = [
  { relativePath: "config/ai/beauty-filter.json", label: "Beauty filter" },
  { relativePath: "config/ai/gender-filter.json", label: "Gender filter" },
  { relativePath: "config/ai/excluded-names.json", label: "Excluded names" },
  { relativePath: "config/ai/espanol/chat.json", label: "Chat persona" },
  { relativePath: "config/ai/espanol/openers.json", label: "Openers" },
  { relativePath: "config/ai/espanol/personal-context.json", label: "Personal context" },
  { relativePath: "config/ai/espanol/analysis.json", label: "Analysis prompt" },
];

const ALLOWED_JSON_PATHS = JSON_CONFIGS.map((config) => config.relativePath);

function resolveAllowedJsonPath(relativePath: string): string {
  const allowedPath = assertAllowedRelativePath(ALLOWED_JSON_PATHS, relativePath);

  return resolveDataFile(allowedPath);
}

function applyDataDir(): void {
  setDataDir(getCupiBotDataDir());
  reloadEnv();
}

function parseEnvFile(content: string): EnvVariable[] {
  const variables: EnvVariable[] = [];
  let pendingComment: string | undefined;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      pendingComment = undefined;
      continue;
    }

    if (trimmed.startsWith("#")) {
      pendingComment = trimmed.replace(/^#\s?/, "");
      continue;
    }

    const eqIndex = trimmed.indexOf("=");

    if (eqIndex === -1) {
      continue;
    }

    variables.push({
      key: trimmed.slice(0, eqIndex).trim(),
      value: trimmed.slice(eqIndex + 1).trim(),
      comment: pendingComment,
    });
    pendingComment = undefined;
  }

  return variables;
}

function serializeEnvFile(variables: EnvVariable[]): string {
  const lines: string[] = [];

  for (const variable of variables) {
    if (variable.comment) {
      lines.push(`# ${variable.comment}`);
    }

    lines.push(`${variable.key}=${variable.value}`);
    lines.push("");
  }

  return lines.join("\n");
}

function copyExampleIfMissing(examplePath: string, targetPath: string): void {
  if (!fs.existsSync(targetPath) && fs.existsSync(examplePath)) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(examplePath, targetPath);
  }
}

export class ConfigService {
  init(): void {
    const dataDir = ensureDataDir();
    applyDataDir();

    const repoRoot = appRoot();

    copyExampleIfMissing(
      path.join(repoRoot, ".env.example"),
      resolveDataFile(".env"),
    );

    for (const config of JSON_CONFIGS) {
      const examplePath = path.join(repoRoot, config.relativePath.replace(".json", ".example.json"));
      const targetPath = resolveDataFile(config.relativePath);

      copyExampleIfMissing(examplePath, targetPath);
    }

    copyExampleIfMissing(
      path.join(repoRoot, "context/instagrams.example.json"),
      resolveDataFile("context/instagrams.json"),
    );

    setDataDir(dataDir);
    reloadEnv();
  }

  readEnv(): EnvVariable[] {
    applyDataDir();
    const envPath = resolveDataFile(".env");

    if (!fs.existsSync(envPath)) {
      return [];
    }

    return parseEnvFile(fs.readFileSync(envPath, "utf-8"));
  }

  writeEnv(variables: EnvVariable[]): void {
    applyDataDir();
    fs.writeFileSync(resolveDataFile(".env"), serializeEnvFile(variables), "utf-8");
    reloadEnv();
  }

  listJsonConfigs(): ConfigJsonFile[] {
    return JSON_CONFIGS;
  }

  readJson(relativePath: string): string {
    const filePath = resolveAllowedJsonPath(relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`config not found: ${relativePath}`);
    }

    return fs.readFileSync(filePath, "utf-8");
  }

  writeJson(relativePath: string, content: string): void {
    JSON.parse(content);
    const filePath = resolveAllowedJsonPath(relativePath);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(JSON.parse(content), null, 2)}\n`, "utf-8");
    reloadEnv();
  }

  validate(): { ok: boolean; errors: string[] } {
    applyDataDir();
    const errors: string[] = [];

    try {
      const appConfig = loadAppConfig();
      loadAiConfig();
      loadAnalysisConfig();
      buildSessionConfig(appConfig, "tinder", 6);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    for (const config of JSON_CONFIGS) {
      const filePath = resolveDataFile(config.relativePath);

      if (!fs.existsSync(filePath)) {
        errors.push(`missing config: ${config.relativePath}`);
      }
    }

    return { ok: errors.length === 0, errors };
  }

  setup(): void {
    this.init();
  }
}

function appRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }

  return process.cwd();
}
