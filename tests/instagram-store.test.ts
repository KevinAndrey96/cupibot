import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDataDir, setDataDir } from "../src/config/data-dir.js";
import { InstagramStore } from "../src/infrastructure/storage/instagram-store.js";
import { createTempDir, removeTempDir } from "./helpers/temp-dir.js";

describe("InstagramStore", () => {
  let tempDir: string;
  let filePath: string;

  afterEach(() => {
    if (tempDir) {
      removeTempDir(tempDir);
    }
  });

  it("saves and loads instagram entries", () => {
    tempDir = createTempDir("ig-store-");
    filePath = path.join(tempDir, "instagrams.json");
    const store = new InstagramStore(filePath);

    store.save({
      name: "Ana",
      platformId: "plat1",
      handle: "@ana_ig",
      collectedAt: "2026-01-15T00:00:00.000Z",
      source: "them",
    });

    const entries = store.loadAll();

    expect(entries).toHaveLength(1);
    expect(entries[0].handle).toBe("@ana_ig");
  });

  it("deduplicates same match and handle", () => {
    tempDir = createTempDir("ig-store-");
    filePath = path.join(tempDir, "instagrams.json");
    const store = new InstagramStore(filePath);
    const entry = {
      name: "Ana",
      platformId: "plat1",
      handle: "@ana_ig",
      collectedAt: "2026-01-15T00:00:00.000Z",
      source: "them" as const,
    };

    store.save(entry);
    store.save(entry);

    expect(store.loadAll()).toHaveLength(1);
  });

  it("detects instagram by platform id", () => {
    tempDir = createTempDir("ig-store-");
    filePath = path.join(tempDir, "instagrams.json");
    const store = new InstagramStore(filePath);

    store.save({
      name: "Ana",
      platformId: "Plat1",
      handle: "@ana_ig",
      collectedAt: "2026-01-15T00:00:00.000Z",
      source: "them",
    });

    expect(store.hasInstagram("plat1")).toBe(true);
    expect(store.hasInstagram("other")).toBe(false);
  });

  it("returns empty array for invalid json", () => {
    tempDir = createTempDir("ig-store-");
    filePath = path.join(tempDir, "instagrams.json");
    const store = new InstagramStore(filePath);

    fs.writeFileSync(filePath, "not-json", "utf-8");

    expect(store.loadAll()).toEqual([]);
  });

  it("resolves default path from the active data dir at construction time", () => {
    const originalDataDir = getDataDir();
    tempDir = createTempDir("ig-store-default-");
    setDataDir(tempDir);

    try {
      const store = new InstagramStore();

      store.save({
        name: "Ana",
        platformId: "plat1",
        handle: "@ana_ig",
        collectedAt: "2026-01-15T00:00:00.000Z",
        source: "them",
      });

      expect(fs.existsSync(path.join(tempDir, "context", "instagrams.json"))).toBe(true);
    } finally {
      setDataDir(originalDataDir);
    }
  });
});
