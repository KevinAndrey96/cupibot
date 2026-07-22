import fs from "node:fs";
import path from "node:path";
import type { UnmatchEntry, UnmatchStorePort } from "../../domain/types.js";
import { resolveDataPath } from "../../config/data-dir.js";

const DEFAULT_FILE_PATH = resolveDataPath("context", "unmatches.json");

export class UnmatchStore implements UnmatchStorePort {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_FILE_PATH;
    const dir = path.dirname(this.filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "[]", "utf-8");
    }
  }

  save(entry: UnmatchEntry): void {
    const entries = this.loadAll();
    const key = entry.platformId || entry.name;
    const exists = entries.some(
      (e) => (e.platformId || e.name).toLowerCase() === key.toLowerCase(),
    );

    if (exists) {
      return;
    }

    entries.push(entry);
    fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
  }

  loadAll(): UnmatchEntry[] {
    const raw = fs.readFileSync(this.filePath, "utf-8");

    try {
      return JSON.parse(raw) as UnmatchEntry[];
    } catch {
      return [];
    }
  }

  isUnmatched(platformId: string): boolean {
    const entries = this.loadAll();

    return entries.some(
      (e) =>
        (e.platformId && e.platformId.toLowerCase() === platformId.toLowerCase()) ||
        (!e.platformId && e.name.toLowerCase() === platformId.toLowerCase()),
    );
  }
}
