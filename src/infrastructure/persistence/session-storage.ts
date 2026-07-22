import fs from "node:fs";
import path from "node:path";
import type { Platform } from "../../domain/types.js";
import { resolveDataPath } from "../../config/data-dir.js";

const USER_DATA_DIR_NAME = "user-data";

export function resolveBrowserSessionDir(platform: Platform): string {
  return resolveDataPath(USER_DATA_DIR_NAME, platform);
}

export function browserSessionExists(platform: Platform): boolean {
  const profileDir = path.join(resolveBrowserSessionDir(platform), "Default");

  return fs.existsSync(profileDir);
}

export function resolveUserDataDir(platform: Platform): string {
  const dir = resolveBrowserSessionDir(platform);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}
