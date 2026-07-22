import path from "node:path";

let dataDir = process.cwd();

export function setDataDir(dir: string): void {
  dataDir = path.resolve(dir);
}

export function getDataDir(): string {
  return dataDir;
}

export function resolveDataPath(...segments: string[]): string {
  return path.resolve(dataDir, ...segments);
}
