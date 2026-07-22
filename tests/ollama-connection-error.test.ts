import { describe, expect, it } from "vitest";
import { isOllamaConnectionError } from "../src/infrastructure/ai/ai-error.js";
import { normalizeOllamaUrl } from "../src/config/env.js";

describe("normalizeOllamaUrl", () => {
  it("rewrites localhost to 127.0.0.1", () => {
    expect(normalizeOllamaUrl("http://localhost:11434")).toBe("http://127.0.0.1:11434");
  });
});

describe("isOllamaConnectionError", () => {
  it("detects fetch failed errors", () => {
    expect(isOllamaConnectionError(new TypeError("fetch failed"))).toBe(true);
  });
});
