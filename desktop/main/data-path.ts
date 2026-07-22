import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const CUPIBOT_DIR = "cupibot";

export function getCupiBotDataDir(): string {
  if (!app.isPackaged) {
    return process.cwd();
  }

  return path.join(app.getPath("userData"), CUPIBOT_DIR);
}

export function ensureDataDir(): string {
  const dataDir = getCupiBotDataDir();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
}

export function resolveDataFile(...segments: string[]): string {
  return path.join(getCupiBotDataDir(), ...segments);
}
