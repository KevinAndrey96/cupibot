import { describe, expect, it } from "vitest";
import { modelIsInstalled, parseOllamaHost } from "../src/infrastructure/ai/ollama-model-utils.js";

describe("parseOllamaHost", () => {
  it("normalizes localhost to 127.0.0.1", () => {
    expect(parseOllamaHost("http://localhost:11434")).toBe("127.0.0.1:11434");
  });

  it("uses default port when omitted", () => {
    expect(parseOllamaHost("http://127.0.0.1")).toBe("127.0.0.1:11434");
  });

  it("preserves custom host and port", () => {
    expect(parseOllamaHost("http://192.168.1.10:8080")).toBe("192.168.1.10:8080");
  });
});

describe("modelIsInstalled", () => {
  const installed = ["llava:7b", "qwen2.5:7b", "gemma3:12b"];

  it("matches exact model name", () => {
    expect(modelIsInstalled("llava:7b", installed)).toBe(true);
  });

  it("matches model prefix", () => {
    expect(modelIsInstalled("llava", installed)).toBe(true);
  });

  it("is case insensitive", () => {
    expect(modelIsInstalled("LLAVA:7B", installed)).toBe(true);
  });

  it("returns false for missing model", () => {
    expect(modelIsInstalled("mistral:7b", installed)).toBe(false);
  });
});
