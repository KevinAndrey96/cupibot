import fs from "node:fs";
import dotenv from "dotenv";
import { resolveDataPath } from "./data-dir.js";

let envLoaded = false;

export function loadEnv(): void {
  if (envLoaded) {
    return;
  }

  const envPath = resolveDataPath(".env");

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }

  envLoaded = true;
}

loadEnv();

export function reloadEnv(): void {
  envLoaded = false;
  loadEnv();
}

export function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  return raw === "true" || raw === "1";
}

export function envInt(key: string, fallback: number): number {
  const raw = process.env[key];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const parsed = parseInt(raw, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`invalid integer for env var ${key}: "${raw}"`);
  }

  return parsed;
}

export function envString(key: string, fallback: string): string {
  const raw = process.env[key];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  return raw;
}

export function normalizeOllamaUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "http://127.0.0.1:11434";
  }
}

export function envOneOf<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = process.env[key];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const normalized = raw.toLowerCase() as T;

  if (!allowed.includes(normalized)) {
    throw new Error(
      `invalid value for env var ${key}: "${raw}" (allowed: ${allowed.join(", ")})`,
    );
  }

  return normalized;
}
