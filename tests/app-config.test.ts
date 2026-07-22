import { describe, expect, it } from "vitest";
import {
  buildChatConfig,
  buildChatSessionConfig,
  buildSessionConfig,
  loadAppConfig,
  modeLabel,
  modeNeedsOllama,
  modePlatform,
  modelsForMode,
  modeUsesChat,
  modeUsesChatBreaks,
  modeUsesAnalysis,
  modeUsesSwipe,
  resolveSwipeCount,
  type ResolvedAppConfig,
} from "../src/config/app-config.js";
import { loadAiConfig } from "../src/config/ai-config.js";

describe("app mode helpers", () => {
  it("maps modes to platform", () => {
    expect(modePlatform("bumble-swipe")).toBe("bumble");
    expect(modePlatform("tinder-chat")).toBe("tinder");
  });

  it("detects swipe, chat, and analysis usage", () => {
    expect(modeUsesSwipe("tinder-chat")).toBe(false);
    expect(modeUsesSwipe("tinder-analisis")).toBe(false);
    expect(modeUsesSwipe("tinder-swipe")).toBe(true);
    expect(modeUsesChat("tinder-chat")).toBe(true);
    expect(modeUsesChat("bumble-swipe")).toBe(false);
    expect(modeUsesChatBreaks("tinder-swipe-chat")).toBe(true);
    expect(modeUsesAnalysis("tinder-analisis")).toBe(true);
    expect(modeNeedsOllama("tinder-analisis")).toBe(true);
    expect(modeNeedsOllama("tinder-swipe")).toBe(true);
  });

  it("returns human labels", () => {
    expect(modeLabel("tinder-swipe-chat")).toBe("Tinder Swipe + Chat");
    expect(modeLabel("tinder-analisis")).toBe("Tinder Análisis");
  });
});

describe("modelsForMode", () => {
  const app = loadAppConfig();

  it("includes swipe model for swipe modes", () => {
    const models = modelsForMode("tinder-swipe", app);

    expect(models).toContain(app.ollama.swipeModel);
    expect(models).not.toContain(app.ollama.chatModel);
  });

  it("includes both models for swipe+chat mode", () => {
    const models = modelsForMode("tinder-swipe-chat", app);

    expect(models).toContain(app.ollama.swipeModel);
    expect(models).toContain(app.ollama.chatModel);
  });

  it("includes only chat model for chat mode", () => {
    const models = modelsForMode("tinder-chat", app);

    expect(models).toEqual([app.ollama.chatModel]);
  });

  it("includes chat model for analysis mode", () => {
    const models = modelsForMode("tinder-analisis", app);

    expect(models).toEqual([app.ollama.chatModel]);
  });
});

describe("resolveSwipeCount", () => {
  it("returns value within configured range", () => {
    const app = loadAppConfig();

    for (let i = 0; i < 20; i++) {
      const count = resolveSwipeCount(app, "tinder");

      expect(count).toBeGreaterThanOrEqual(app.swipe.tinder.minSwipes);
      expect(count).toBeLessThanOrEqual(app.swipe.tinder.maxSwipes);
    }
  });
});

describe("buildSessionConfig", () => {
  it("builds valid session config", () => {
    const app = loadAppConfig();
    const config = buildSessionConfig(app, "tinder", 6);

    expect(config.maxSwipes).toBeGreaterThanOrEqual(1);
    expect(config.swipeModel).toBe(app.ollama.swipeModel);
    expect(config.minAttractivenessScore).toBe(6);
  });

  it("throws on invalid delay configuration", () => {
    const app = loadAppConfig();
    const invalid: ResolvedAppConfig = {
      ...app,
      swipe: {
        ...app.swipe,
        minDelayMs: 5000,
        maxDelayMs: 1000,
      },
    };

    expect(() => buildSessionConfig(invalid, "tinder", 6)).toThrow(
      "maxDelayMs must be >= minDelayMs",
    );
  });
});

describe("buildChatConfig", () => {
  it("maps chat settings from app config", () => {
    const app = loadAppConfig();
    const chat = buildChatConfig(app);

    expect(chat.chatModel).toBe(app.ollama.chatModel);
    expect(chat.ollamaUrl).toBe(app.ollama.url);
  });
});

describe("loadAppConfig", () => {
  it("loads expected default models", () => {
    const app = loadAppConfig();

    expect(app.ollama.swipeModel).toBeTruthy();
    expect(app.ollama.chatModel).toBeTruthy();
    expect(app.swipe.chatBreakInterval).toBeGreaterThanOrEqual(1);
  });
});

describe("buildChatSessionConfig", () => {
  it("builds chat session config from ai bundle", () => {
    const ai = loadAiConfig();
    const config = buildChatSessionConfig(ai);

    expect(config.personaName).toBe(ai.chat.personaName);
    expect(config.instagramHandle).toBe(ai.chat.instagramHandle);
    expect(config.selfHandles.has(ai.chat.selfHandles[0].toLowerCase())).toBe(true);
    expect(config.instagramAskPattern.test("me pasas tu insta?")).toBe(true);
  });
});
