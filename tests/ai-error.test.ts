import { describe, expect, it } from "vitest";
import { AiConsultationError, isAiConsultationError } from "../src/infrastructure/ai/ai-error.js";

describe("AiConsultationError", () => {
  it("wraps cause with context", () => {
    const error = new AiConsultationError("gender check", new Error("timeout"));

    expect(error.name).toBe("AiConsultationError");
    expect(error.context).toBe("gender check");
    expect(error.message).toContain("gender check");
    expect(error.message).toContain("timeout");
  });

  it("wraps string causes", () => {
    const error = new AiConsultationError("scoring", "unparseable response");

    expect(error.message).toContain("unparseable response");
  });
});

describe("isAiConsultationError", () => {
  it("identifies AiConsultationError instances", () => {
    const error = new AiConsultationError("test", "fail");

    expect(isAiConsultationError(error)).toBe(true);
    expect(isAiConsultationError(new Error("other"))).toBe(false);
    expect(isAiConsultationError("string")).toBe(false);
  });
});
