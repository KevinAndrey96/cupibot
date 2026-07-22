import { describe, expect, it } from "vitest";
import { formatAiFailure } from "../src/infrastructure/ai/ai-error.js";
import { setDataDir, getDataDir } from "../src/config/data-dir.js";

describe("formatAiFailure", () => {
  it("formats generic errors", () => {
    const result = formatAiFailure(new Error("boom"));

    expect(result.code).toBe("Error");
    expect(result.message).toBe("boom");
  });
});

describe("data-dir", () => {
  it("allows overriding data directory", () => {
    const original = getDataDir();
    setDataDir("/tmp/cupibot-test");
    expect(getDataDir()).toBe("/tmp/cupibot-test");
    setDataDir(original);
  });
});
