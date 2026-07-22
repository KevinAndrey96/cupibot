import { describe, expect, it } from "vitest";
import { parseScoringResponse } from "../src/infrastructure/ai/scoring-parser.js";

describe("parseScoringResponse", () => {
  it("parses SCORE label with multiline reason", () => {
    const result = parseScoringResponse(
      "SCORE: 7\nreason: fair skin, blonde hair, feminine features",
    );

    expect(result.score).toBe(7);
    expect(result.reason).toBe("fair skin, blonde hair, feminine features");
  });

  it("parses SCORE:reason on one line", () => {
    const result = parseScoringResponse("SCORE: 8:fair skin nice smile");

    expect(result.score).toBe(8);
    expect(result.reason).toBe("fair skin nice smile");
  });

  it("parses score and reason", () => {
    const result = parseScoringResponse("8:light skin pretty smile");

    expect(result.score).toBe(8);
    expect(result.reason).toBe("light skin pretty smile");
  });

  it("parses reason with colons", () => {
    const result = parseScoringResponse("7:pretty:latina smile");

    expect(result.score).toBe(7);
    expect(result.reason).toBe("pretty:latina smile");
  });

  it("returns null score for non-numeric input", () => {
    const result = parseScoringResponse("SKIP:not his type");

    expect(result.score).toBeNull();
    expect(result.reason).toBeNull();
  });

  it("returns null for empty input", () => {
    const result = parseScoringResponse("");

    expect(result.score).toBeNull();
    expect(result.reason).toBeNull();
  });

  it("parses word-based SCORE labels", () => {
    expect(parseScoringResponse("SCORE: average").score).toBe(5);
    expect(parseScoringResponse("SCORE: good").score).toBe(7);
  });

  it("parses single digit scores", () => {
    expect(parseScoringResponse("9:exceptional").score).toBe(9);
    expect(parseScoringResponse("1:masculine look").score).toBe(1);
  });
});
