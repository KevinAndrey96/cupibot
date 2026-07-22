import fs from "node:fs";
import type { Platform } from "../../domain/types.js";
import { resolveDataPath } from "../../config/data-dir.js";

const USER_DATA_DIR_NAME = "user-data";

export function resolveUserDataDir(platform: Platform): string {
  const dir = resolveDataPath(USER_DATA_DIR_NAME, platform);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}
