import { describe, expect, it, vi } from "vitest";
import { detectUnmatches } from "../src/application/unmatch-detector.js";
import type {
  ChatMessage,
  Conversation,
  ConversationStorePort,
  InstagramStorePort,
  UnmatchStorePort,
} from "../src/domain/types.js";

function createConversationStore(known: Array<{ name: string; platformId: string }>, conversations: Record<string, Conversation>): ConversationStorePort {
  return {
    listAll: vi.fn().mockReturnValue(known),
    load: vi.fn().mockImplementation((platformId: string, name: string) => {
      const key = platformId || name;

      return conversations[key] ?? { name, platformId, messages: [] };
    }),
    save: vi.fn(),
    merge: vi.fn(),
    exportHistorical: vi.fn(),
  };
}

describe("detectUnmatches", () => {
  it("records conversations missing from the visible list", () => {
    const save = vi.fn();
    const unmatchStore: UnmatchStorePort = {
      save,
      loadAll: vi.fn().mockReturnValue([]),
      isUnmatched: vi.fn().mockReturnValue(false),
    };
    const instagramStore: InstagramStorePort = {
      save: vi.fn(),
      loadAll: vi.fn().mockReturnValue([]),
      hasInstagram: vi.fn().mockReturnValue(false),
    };
    const messages: ChatMessage[] = [
      { sender: "them", content: "hola", timestamp: new Date("2026-01-01T10:00:00Z") },
    ];

    const conversationStore = createConversationStore(
      [
        { name: "Ana", platformId: "abc123" },
        { name: "Maria", platformId: "gone99" },
      ],
      {
        abc123: { name: "Ana", platformId: "abc123", messages },
        gone99: {
          name: "Maria",
          platformId: "gone99",
          messages: [{ sender: "me", content: "hey", timestamp: new Date("2026-01-02T10:00:00Z") }],
        },
      },
    );

    const detected = detectUnmatches(
      [{ name: "Ana", platformId: "abc123" }],
      {
        conversationStore,
        unmatchStore,
        instagramStore,
        systemConversations: new Set(),
      },
      "[Test]",
    );

    expect(detected).toBe(1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Maria",
        platformId: "gone99",
        lastMessageSender: "me",
      }),
    );
  });

  it("skips system conversations", () => {
    const save = vi.fn();
    const unmatchStore: UnmatchStorePort = {
      save,
      loadAll: vi.fn().mockReturnValue([]),
      isUnmatched: vi.fn().mockReturnValue(false),
    };
    const instagramStore: InstagramStorePort = {
      save: vi.fn(),
      loadAll: vi.fn().mockReturnValue([]),
      hasInstagram: vi.fn().mockReturnValue(false),
    };
    const conversationStore = createConversationStore(
      [{ name: "Bumble Team", platformId: "sys001" }],
      {},
    );

    const detected = detectUnmatches(
      [],
      {
        conversationStore,
        unmatchStore,
        instagramStore,
        systemConversations: new Set(["bumble team"]),
      },
    );

    expect(detected).toBe(0);
    expect(save).not.toHaveBeenCalled();
  });
});
