import { describe, expect, it } from "vitest";
import {
  mapRawDomMessages,
  parseChatTimestamp,
} from "../src/infrastructure/browser/chat-timestamp.js";

describe("parseChatTimestamp", () => {
  const reference = new Date("2026-07-15T15:00:00");

  it("parses clock time on the same day", () => {
    const result = parseChatTimestamp("10:30 AM", reference);

    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
    expect(result.getDate()).toBe(15);
  });

  it("parses 24h clock time", () => {
    const result = parseChatTimestamp("14:45", reference);

    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(45);
  });

  it("moves to yesterday when clock time is ahead of reference", () => {
    const result = parseChatTimestamp("4:30 PM", reference);

    expect(result.getDate()).toBe(14);
    expect(result.getHours()).toBe(16);
    expect(result.getMinutes()).toBe(30);
  });

  it("parses sent-at labels", () => {
    const result = parseChatTimestamp("Sent at 10:42 AM", reference);

    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(42);
    expect(result.getDate()).toBe(15);
  });

  it("parses day-only labels", () => {
    const yesterday = parseChatTimestamp("Yesterday", reference);
    const hoy = parseChatTimestamp("Hoy", reference);

    expect(yesterday.getDate()).toBe(14);
    expect(hoy.getDate()).toBe(15);
  });

  it("parses ISO datetime attributes", () => {
    const result = parseChatTimestamp(
      "2026-07-10T18:22:00.000Z",
      reference,
    );

    expect(result.toISOString()).toBe("2026-07-10T18:22:00.000Z");
  });

  it("falls back to reference when label is empty", () => {
    const result = parseChatTimestamp(null, reference);

    expect(result.getTime()).toBe(reference.getTime());
  });
});

describe("mapRawDomMessages", () => {
  it("keeps monotonic timestamps when labels are missing", () => {
    const reference = new Date("2026-07-15T10:00:00");
    const messages = mapRawDomMessages(
      [
        { sender: "them", content: "hola", timeLabel: "9:00 AM" },
        { sender: "me", content: "que tal", timeLabel: null },
        { sender: "them", content: "bien", timeLabel: "9:05 AM" },
      ],
      reference,
    );

    expect(messages[0]?.timestamp.getHours()).toBe(9);
    expect(messages[1]?.timestamp.getTime()).toBeGreaterThanOrEqual(
      messages[0]!.timestamp.getTime(),
    );
    expect(messages[2]?.timestamp.getHours()).toBe(9);
    expect(messages[2]?.timestamp.getMinutes()).toBe(5);
  });
});
