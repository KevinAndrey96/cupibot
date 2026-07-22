import fs from "node:fs";
import path from "node:path";
import type { InstagramEntry, InstagramStorePort } from "../../domain/types.js";
import { resolveDataPath } from "../../config/data-dir.js";

function defaultFilePath(): string {
  return resolveDataPath("context", "instagrams.json");
}

export class InstagramStore implements InstagramStorePort {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? defaultFilePath();
    const dir = path.dirname(this.filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "[]", "utf-8");
    }
  }

  save(entry: InstagramEntry): void {
    const entries = this.loadAll();
    const exists = entries.some(
      (e) =>
        this.matchesKey(e, entry.platformId, entry.name) &&
        e.handle.toLowerCase() === entry.handle.toLowerCase(),
    );

    if (exists) {
      return;
    }

    entries.push(entry);
    fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
  }

  loadAll(): InstagramEntry[] {
    const raw = fs.readFileSync(this.filePath, "utf-8");

    try {
      return JSON.parse(raw) as InstagramEntry[];
    } catch {
      return [];
    }
  }

  hasInstagram(platformId: string): boolean {
    const entries = this.loadAll();

    return entries.some(
      (e) =>
        (e.platformId && e.platformId.toLowerCase() === platformId.toLowerCase()) ||
        (!e.platformId && e.name.toLowerCase() === platformId.toLowerCase()),
    );
  }

  private matchesKey(entry: InstagramEntry, platformId: string, name: string): boolean {
    if (platformId && entry.platformId) {
      return entry.platformId.toLowerCase() === platformId.toLowerCase();
    }

    return entry.name.toLowerCase() === name.toLowerCase();
  }
}
