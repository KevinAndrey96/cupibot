import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UnmatchStore } from "../src/infrastructure/storage/unmatch-store.js";
import { createTempDir, removeTempDir } from "./helpers/temp-dir.js";

describe("UnmatchStore", () => {
  let tempDir: string;
  let filePath: string;

  afterEach(() => {
    if (tempDir) {
      removeTempDir(tempDir);
    }
  });

  it("saves and loads unmatch entries", () => {
    tempDir = createTempDir("unmatch-store-");
    filePath = path.join(tempDir, "unmatches.json");
    const store = new UnmatchStore(filePath);

    store.save({
      name: "Carlos",
      platformId: "plat9",
      detectedAt: "2026-01-15T00:00:00.000Z",
      lastMessageSender: "them",
      lastMessageContent: "hola",
      totalMessages: 3,
      hadInstagram: false,
    });

    const entries = store.loadAll();

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Carlos");
  });

  it("deduplicates by platform id", () => {
    tempDir = createTempDir("unmatch-store-");
    filePath = path.join(tempDir, "unmatches.json");
    const store = new UnmatchStore(filePath);
    const entry = {
      name: "Carlos",
      platformId: "plat9",
      detectedAt: "2026-01-15T00:00:00.000Z",
      lastMessageSender: "them" as const,
      lastMessageContent: "hola",
      totalMessages: 3,
      hadInstagram: false,
    };

    store.save(entry);
    store.save(entry);

    expect(store.loadAll()).toHaveLength(1);
  });

  it("checks unmatched status case-insensitively", () => {
    tempDir = createTempDir("unmatch-store-");
    filePath = path.join(tempDir, "unmatches.json");
    const store = new UnmatchStore(filePath);

    store.save({
      name: "Carlos",
      platformId: "Plat9",
      detectedAt: "2026-01-15T00:00:00.000Z",
      lastMessageSender: "them",
      lastMessageContent: "hola",
      totalMessages: 3,
      hadInstagram: false,
    });

    expect(store.isUnmatched("plat9")).toBe(true);
    expect(store.isUnmatched("other")).toBe(false);
  });

  it("returns empty array for invalid json", () => {
    tempDir = createTempDir("unmatch-store-");
    filePath = path.join(tempDir, "unmatches.json");
    const store = new UnmatchStore(filePath);

    fs.writeFileSync(filePath, "not-json", "utf-8");

    expect(store.loadAll()).toEqual([]);
  });
});
