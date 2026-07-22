import { describe, expect, it } from "vitest";
import { parseChatResponse } from "../src/infrastructure/ai/chat-response-parser.js";

describe("parseChatResponse", () => {
  it("strips persona label prefix", () => {
    const result = parseChatResponse(
      "Kevin: hola, todo bien?",
      "Kevin",
      "@KevinAndrey96",
    );

    expect(result.message).toBe("hola, todo bien?");
    expect(result.unknownQuestions).toEqual([]);
  });

  it("removes wrapping quotes", () => {
    const result = parseChatResponse(
      '"hola que tal"',
      "Kevin",
      "@KevinAndrey96",
    );

    expect(result.message).toBe("hola que tal");
  });

  it("extracts unknown questions", () => {
    const result = parseChatResponse(
      "no se la verdad\nUNKNOWN_Q:\"Cuál es tu comida favorita?\"",
      "Kevin",
      "@KevinAndrey96",
    );

    expect(result.message).toBe("no se la verdad");
    expect(result.unknownQuestions).toEqual(["Cuál es tu comida favorita?"]);
  });

  it("normalizes instagram handle casing", () => {
    const result = parseChatResponse(
      "hablamos por insta kevinandrey96",
      "Kevin",
      "@KevinAndrey96",
    );

    expect(result.message).toBe("hablamos por insta @KevinAndrey96");
  });

  it("strips spanish opening punctuation", () => {
    const result = parseChatResponse(
      "¿Qué tal? ¡Hola!",
      "Kevin",
      "@KevinAndrey96",
    );

    expect(result.message).toBe("Qué tal? Hola!");
  });
});
