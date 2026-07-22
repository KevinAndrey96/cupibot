import { afterEach, describe, expect, it } from "vitest";
import { ConversationStore } from "../src/infrastructure/storage/conversation-store.js";
import { createTempDir, removeTempDir } from "./helpers/temp-dir.js";

describe("ConversationStore", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      removeTempDir(tempDir);
    }
  });

  it("loads empty conversation for unknown match", () => {
    tempDir = createTempDir("conv-store-");
    const store = new ConversationStore(tempDir);
    const conv = store.load("abc123", "Maria");

    expect(conv.messages).toEqual([]);
    expect(conv.name).toBe("Maria");
    expect(conv.platformId).toBe("abc123");
  });

  it("saves and loads messages", () => {
    tempDir = createTempDir("conv-store-");
    const store = new ConversationStore(tempDir);
    const timestamp = new Date("2026-01-15T12:00:00.000Z");
    const messages = [
      { sender: "them" as const, content: "hola", timestamp },
      { sender: "me" as const, content: "que tal", timestamp },
    ];

    store.save({ name: "Ana", platformId: "id1", messages });
    const loaded = store.load("id1", "Ana");

    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[0].content).toBe("hola");
    expect(loaded.messages[1].sender).toBe("me");
  });

  it("merges fresh messages when store is empty", () => {
    tempDir = createTempDir("conv-store-");
    const store = new ConversationStore(tempDir);
    const timestamp = new Date("2026-01-15T12:00:00.000Z");
    const fresh = [{ sender: "them" as const, content: "hola", timestamp }];

    const merged = store.merge("id2", "Lu", fresh);

    expect(merged.messages).toEqual(fresh);
    expect(store.load("id2", "Lu").messages).toEqual(fresh);
  });

  it("returns existing when fresh messages are empty", () => {
    tempDir = createTempDir("conv-store-");
    const store = new ConversationStore(tempDir);
    const timestamp = new Date("2026-01-15T12:00:00.000Z");
    const existing = [{ sender: "them" as const, content: "hola", timestamp }];

    store.save({ name: "Lu", platformId: "id2", messages: existing });
    const merged = store.merge("id2", "Lu", []);

    expect(merged.messages).toEqual(existing);
  });

  it("appends after overlap anchor", () => {
    tempDir = createTempDir("conv-store-");
    const store = new ConversationStore(tempDir);
    const t1 = new Date("2026-01-15T12:00:00.000Z");
    const t2 = new Date("2026-01-15T12:01:00.000Z");
    const existing = [
      { sender: "them" as const, content: "hola", timestamp: t1 },
      { sender: "me" as const, content: "que tal", timestamp: t1 },
    ];
    const fresh = [
      { sender: "them" as const, content: "hola", timestamp: t2 },
      { sender: "them" as const, content: "todo bien", timestamp: t2 },
      { sender: "me" as const, content: "si y tu", timestamp: t2 },
    ];

    store.save({ name: "Lu", platformId: "id3", messages: existing });
    const merged = store.merge("id3", "Lu", fresh);

    expect(merged.messages).toHaveLength(4);
    expect(merged.messages[2].content).toBe("todo bien");
    expect(merged.messages[3].content).toBe("si y tu");
  });

  it("deduplicates when no overlap anchor is found", () => {
    tempDir = createTempDir("conv-store-");
    const store = new ConversationStore(tempDir);
    const timestamp = new Date("2026-01-15T12:00:00.000Z");
    const existing = [
      { sender: "them" as const, content: "hola", timestamp },
      { sender: "me" as const, content: "que tal", timestamp },
    ];
    const fresh = [
      { sender: "them" as const, content: "hola", timestamp },
      { sender: "them" as const, content: "nueva pregunta", timestamp },
    ];

    store.save({ name: "Lu", platformId: "id4", messages: existing });
    const merged = store.merge("id4", "Lu", fresh);

    expect(merged.messages).toHaveLength(3);
    expect(merged.messages[2].content).toBe("nueva pregunta");
  });

  it("lists saved conversations", () => {
    tempDir = createTempDir("conv-store-");
    const store = new ConversationStore(tempDir);
    const timestamp = new Date("2026-01-15T12:00:00.000Z");

    store.save({
      name: "Ana",
      platformId: "plat99",
      messages: [{ sender: "them", content: "hola", timestamp }],
    });

    const listed = store.listAll();

    expect(listed).toEqual([{ name: "Ana", platformId: "plat99" }]);
  });
});
