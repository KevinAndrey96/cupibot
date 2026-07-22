import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDataDir, setDataDir } from "../src/config/data-dir.js";
import { resolveUserDataDir, browserSessionExists } from "../src/infrastructure/persistence/session-storage.js";
import { createTempDir, removeTempDir } from "./helpers/temp-dir.js";

describe("resolveUserDataDir", () => {
  let tempDir: string;
  let originalDataDir: string;

  beforeEach(() => {
    originalDataDir = getDataDir();
    tempDir = createTempDir("session-storage-");
    setDataDir(tempDir);
  });

  afterEach(() => {
    setDataDir(originalDataDir);
    removeTempDir(tempDir);
  });

  it("creates platform-specific user data directory", () => {
    const dir = resolveUserDataDir("tinder");

    expect(dir.endsWith(path.join("user-data", "tinder"))).toBe(true);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("returns existing directory without error", () => {
    const first = resolveUserDataDir("bumble");
    const second = resolveUserDataDir("bumble");

    expect(second).toBe(first);
  });

  it("detects saved browser profile directories", () => {
    expect(browserSessionExists("tinder")).toBe(false);

    const dir = resolveUserDataDir("tinder");
    fs.mkdirSync(path.join(dir, "Default"), { recursive: true });

    expect(browserSessionExists("tinder")).toBe(true);
  });
});
