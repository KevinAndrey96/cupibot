import { describe, expect, it } from "vitest";
import {
  OLLAMA_BINARIES,
  commandExists,
  locateOllamaBinary,
} from "../src/infrastructure/bootstrap/ollama-binary-locator.js";
import { isChromiumInstalled } from "../src/infrastructure/bootstrap/playwright-bootstrap.js";

describe("locateOllamaBinary", () => {
  it("returns a string path when ollama is installed", async () => {
    const binary = await locateOllamaBinary();

    if (binary) {
      expect(binary.length).toBeGreaterThan(0);
    } else {
      expect(binary).toBeNull();
    }
  });

  it("lists known macOS install paths", () => {
    expect(OLLAMA_BINARIES).toContain("/opt/homebrew/bin/ollama");
  });
});

describe("commandExists", () => {
  it("detects node on PATH", async () => {
    expect(await commandExists("node")).toBe(true);
  });

  it("returns false for missing commands", async () => {
    expect(await commandExists("definitely-not-a-real-command-xyz")).toBe(false);
  });
});

describe("isChromiumInstalled", () => {
  it("returns a boolean without throwing", () => {
    expect(typeof isChromiumInstalled()).toBe("boolean");
  });
});
