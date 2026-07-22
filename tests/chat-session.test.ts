import { describe, expect, it, vi } from "vitest";
import { ChatSession } from "../src/application/chat-session.js";
import type {
  ChatGeneratorPort,
  ChatPagePort,
  ConversationPreview,
  ConversationStorePort,
  InstagramStorePort,
  PersonalContextStorePort,
  UnmatchStorePort,
} from "../src/domain/types.js";

function createMocks() {
  const preview: ConversationPreview = {
    name: "Ana",
    platformId: "abc",
    index: 0,
  };

  const chatPage: ChatPagePort = {
    navigateToMessages: vi.fn().mockResolvedValue(undefined),
    getConversationPreviews: vi.fn().mockResolvedValue([preview]),
    getAllVisibleConversations: vi.fn().mockResolvedValue([]),
    scrollConversationList: vi.fn().mockResolvedValue(undefined),
    openConversation: vi.fn().mockResolvedValue(undefined),
    getOpenConversationName: vi.fn().mockResolvedValue("Ana"),
    readMessages: vi.fn().mockResolvedValue([
      { sender: "them", content: "hola", timestamp: new Date() },
    ]),
    typeMessage: vi.fn().mockResolvedValue(true),
    confirmSend: vi.fn().mockResolvedValue(true),
    sendMessage: vi.fn().mockResolvedValue(true),
    goBackToConversationList: vi.fn().mockResolvedValue(undefined),
  };

  const chatGenerator: ChatGeneratorPort = {
    generateReply: vi.fn().mockResolvedValue({
      message: "que mas",
      unknownQuestions: [],
    }),
  };

  const conversationStore: ConversationStorePort = {
    load: vi.fn().mockReturnValue({
      name: "Ana",
      platformId: "abc",
      messages: [{ sender: "them", content: "hola", timestamp: new Date() }],
    }),
    save: vi.fn(),
    merge: vi.fn().mockReturnValue({
      name: "Ana",
      platformId: "abc",
      messages: [{ sender: "them", content: "hola", timestamp: new Date() }],
    }),
    listAll: vi.fn().mockReturnValue([]),
    exportHistorical: vi.fn(),
  };

  const contextStore: PersonalContextStorePort = {
    loadKnownContext: vi.fn().mockReturnValue([]),
    logUnknownQuestion: vi.fn(),
  };

  const instagramStore: InstagramStorePort = {
    save: vi.fn(),
    loadAll: vi.fn().mockReturnValue([]),
    hasInstagram: vi.fn().mockReturnValue(false),
  };

  const unmatchStore: UnmatchStorePort = {
    save: vi.fn(),
    loadAll: vi.fn().mockReturnValue([]),
    isUnmatched: vi.fn().mockReturnValue(false),
  };

  return {
    preview,
    chatPage,
    chatGenerator,
    conversationStore,
    contextStore,
    instagramStore,
    unmatchStore,
  };
}

describe("ChatSession", () => {
  it("sends reply in normal mode", async () => {
    const mocks = createMocks();
    const session = new ChatSession(
      mocks.chatPage,
      mocks.chatGenerator,
      mocks.conversationStore,
      mocks.contextStore,
      mocks.instagramStore,
      mocks.unmatchStore,
      {
        chatDryRun: false,
        chatReplyAll: false,
        chatModel: "test",
        chatSendDelayS: 0,
        chatMaxConversations: 5,
        chatCycleMinMin: 0,
        chatCycleMaxMin: 0,
        ollamaUrl: "http://localhost",
        headless: false,
      },
      {
        personaName: "Kevin",
        instagramHandle: "@kevin",
        selfHandles: new Set(["kevin"]),
        instagramAskPattern: /insta/i,
        systemConversations: new Set(),
        systemMessagePatterns: [],
      },
    );

    await session.runCycle();

    expect(mocks.chatGenerator.generateReply).toHaveBeenCalled();
    expect(mocks.chatPage.confirmSend).toHaveBeenCalled();
  });

  it("does not send in dry-run mode", async () => {
    const mocks = createMocks();
    const session = new ChatSession(
      mocks.chatPage,
      mocks.chatGenerator,
      mocks.conversationStore,
      mocks.contextStore,
      mocks.instagramStore,
      mocks.unmatchStore,
      {
        chatDryRun: true,
        chatReplyAll: false,
        chatModel: "test",
        chatSendDelayS: 0,
        chatMaxConversations: 5,
        chatCycleMinMin: 0,
        chatCycleMaxMin: 0,
        ollamaUrl: "http://localhost",
        headless: false,
      },
      {
        personaName: "Kevin",
        instagramHandle: "@kevin",
        selfHandles: new Set(["kevin"]),
        instagramAskPattern: /insta/i,
        systemConversations: new Set(),
        systemMessagePatterns: [],
      },
    );

    await session.runCycle();

    expect(mocks.chatGenerator.generateReply).toHaveBeenCalled();
    expect(mocks.chatPage.confirmSend).not.toHaveBeenCalled();
  });

  it("skips when last message is already mine", async () => {
    const mocks = createMocks();
    mocks.chatPage.readMessages = vi.fn().mockResolvedValue([
      { sender: "me", content: "ya respondi", timestamp: new Date() },
    ]);
    mocks.conversationStore.merge = vi.fn().mockReturnValue({
      name: "Ana",
      platformId: "abc",
      messages: [{ sender: "me", content: "ya respondi", timestamp: new Date() }],
    });

    const session = new ChatSession(
      mocks.chatPage,
      mocks.chatGenerator,
      mocks.conversationStore,
      mocks.contextStore,
      mocks.instagramStore,
      mocks.unmatchStore,
      {
        chatDryRun: false,
        chatReplyAll: false,
        chatModel: "test",
        chatSendDelayS: 0,
        chatMaxConversations: 5,
        chatCycleMinMin: 0,
        chatCycleMaxMin: 0,
        ollamaUrl: "http://localhost",
        headless: false,
      },
      {
        personaName: "Kevin",
        instagramHandle: "@kevin",
        selfHandles: new Set(["kevin"]),
        instagramAskPattern: /insta/i,
        systemConversations: new Set(),
        systemMessagePatterns: [],
      },
    );

    await session.runCycle();

    expect(mocks.chatGenerator.generateReply).not.toHaveBeenCalled();
  });
});
