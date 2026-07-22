import { describe, expect, it } from "vitest";
import {
  HISTORICAL_EXPORT_VERSION,
  mergeHistoricalExports,
  parseHistoricalExport,
} from "../src/infrastructure/storage/conversation-store.js";

describe("historical export helpers", () => {
  it("parses legacy array format", () => {
    const raw = JSON.stringify([
      { name: "Ana", platformId: "a1", messages: [] },
    ]);

    expect(parseHistoricalExport(raw)).toHaveLength(1);
  });

  it("parses versioned export format", () => {
    const raw = JSON.stringify({
      version: HISTORICAL_EXPORT_VERSION,
      exportedAt: "2026-01-01T00:00:00.000Z",
      conversations: [{ name: "Ana", platformId: "a1", messages: [] }],
    });

    const parsed = parseHistoricalExport(raw);

    expect(parsed[0].name).toBe("Ana");
  });

  it("merges by platformId preferring fresh data", () => {
    const merged = mergeHistoricalExports(
      [{ name: "Ana", platformId: "a1", messages: [{ sender: "me", content: "old", timestamp: "t" }] }],
      [{ name: "Ana", platformId: "a1", messages: [{ sender: "them", content: "new", timestamp: "t" }] }],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].messages[0].content).toBe("new");
  });
});
