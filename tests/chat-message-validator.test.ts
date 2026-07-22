import { describe, expect, it } from "vitest";
import { validateChatMessage } from "../src/infrastructure/ai/chat-message-validator.js";

const validationConfig = {
  bannedPhrases: ["qué genial", "me encantaría saber"],
  bannedEmojis: ["😊"],
};

describe("validateChatMessage", () => {
  it("accepts natural casual spanish", () => {
    const violations = validateChatMessage(
      "ah serio? yo ando por bogotá ahora",
      "me gusta viajar mucho",
      validationConfig,
    );

    expect(violations).toEqual([]);
  });

  it("rejects banned phrases", () => {
    const violations = validateChatMessage(
      "qué genial! me encantaría saber más",
      "",
      validationConfig,
    );

    expect(violations.some((v) => v.includes("banned phrase"))).toBe(true);
  });

  it("rejects banned emojis", () => {
    const violations = validateChatMessage(
      "hola 😊",
      "",
      validationConfig,
    );

    expect(violations).toContain("banned emoji: 😊");
  });

  it("rejects multiple questions", () => {
    const violations = validateChatMessage(
      "de dónde eres? y qué haces?",
      "",
      validationConfig,
    );

    expect(violations).toContain("too many questions in one message");
  });

  it("rejects overly long messages", () => {
    const violations = validateChatMessage(
      "a".repeat(141),
      "",
      validationConfig,
    );

    expect(violations).toContain("message too long for casual chat");
  });

  it("rejects robotic qué opener", () => {
    const violations = validateChatMessage(
      "Qué genial! cuéntame más",
      "",
      validationConfig,
    );

    expect(violations).toContain("robotic opener: Qué/Que + adjective");
  });

  it("rejects echoing her message", () => {
    const violations = validateChatMessage(
      "viajar mucho por el mundo suena increíble",
      "me encanta viajar mucho por el mundo",
      validationConfig,
    );

    expect(violations).toContain("echoing her message");
  });
});
