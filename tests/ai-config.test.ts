import { describe, expect, it } from "vitest";
import {
  isExcludedName,
  loadAiConfig,
  pickRandomOpener,
  resolveAiLanguage,
} from "../src/config/ai-config.js";

describe("resolveAiLanguage", () => {
  it("defaults to espanol", () => {
    expect(resolveAiLanguage()).toBe("espanol");
  });
});

describe("loadAiConfig", () => {
  it("loads all required config sections from language folder", () => {
    const config = loadAiConfig();

    expect(config.genderFilter.enabled).toBe(true);
    expect(config.beautyFilter.minScore).toBeGreaterThanOrEqual(1);
    expect(config.excludedNames.names.length).toBeGreaterThan(10);
    expect(config.openers.messages.length).toBeGreaterThan(0);
    expect(config.chat.systemPrompt).toContain("{knownContext}");
    expect(config.personalContext.length).toBeGreaterThan(0);
    expect(config.genderFilter.genderPrompt).toContain("gender classifier");
    expect(config.beautyFilter.scoringPrompt).toContain("strict visual judge");
  });

  it("loads chat persona from config", () => {
    const config = loadAiConfig();

    expect(config.chat.personaName.length).toBeGreaterThan(0);
    expect(config.chat.maxRetries).toBeGreaterThanOrEqual(1);
  });
});

describe("isExcludedName", () => {
  const excluded = new Set(loadAiConfig().excludedNames.names);

  it("detects masculine first names", () => {
    expect(isExcludedName("Carlos", excluded)).toBe(true);
    expect(isExcludedName("João Silva", excluded)).toBe(true);
  });

  it("normalizes accents", () => {
    expect(isExcludedName("José", excluded)).toBe(true);
  });

  it("allows feminine names", () => {
    expect(isExcludedName("Maria", excluded)).toBe(false);
    expect(isExcludedName("Ana Paula", excluded)).toBe(false);
  });

  it("returns false for empty name", () => {
    expect(isExcludedName("", excluded)).toBe(false);
  });
});

describe("pickRandomOpener", () => {
  it("returns a message from the pool", () => {
    const messages = ["hola", "oi", "hey"];
    const opener = pickRandomOpener(messages);

    expect(messages).toContain(opener);
  });
});
