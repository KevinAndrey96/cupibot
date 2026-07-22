import fs from "node:fs";
import path from "node:path";
import { resolveDataPath } from "./data-dir.js";
import { resolveAiLanguage } from "./ai-config.js";
import { envInt } from "./env.js";

const aiDir = () => resolveDataPath("config", "ai");

export interface AnalysisConfig {
  systemPrompt: string;
  temperature: number;
  timeoutMs: number;
  maxConversationSamples: number;
}

interface AnalysisConfigRaw {
  systemPrompt: string | string[];
  temperature: number;
  timeoutMs: number;
  maxConversationSamples: number;
}

function normalizePrompt(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.join("\n");
  }

  return value;
}

export function loadAnalysisConfig(): AnalysisConfig {
  const lang = resolveAiLanguage();
  const filePath = path.join(aiDir(), lang, "analysis.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(`analysis config not found for AI_LANGUAGE="${lang}" at ${filePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as AnalysisConfigRaw;

  return {
    systemPrompt: normalizePrompt(raw.systemPrompt),
    temperature: raw.temperature,
    timeoutMs: envInt("ANALYSIS_TIMEOUT_MS", raw.timeoutMs),
    maxConversationSamples: raw.maxConversationSamples,
  };
}
