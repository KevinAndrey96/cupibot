import { describe, expect, it, vi } from "vitest";
import { AnalysisSession } from "../src/application/analysis-session.js";
import type {
  ChatMessage,
  ChatPagePort,
  ConversationPreview,
  ConversationStorePort,
  InstagramStorePort,
  UnmatchStorePort,
} from "../src/domain/types.js";

function createChatPageMock(): ChatPagePort {
  const previews: ConversationPreview[] = [
    { name: "Ana", platformId: "abc123", index: 0 },
  ];
  const messages: ChatMessage[] = [
    { sender: "them", content: "hola", timestamp: new Date("2026-01-01T10:00:00Z") },
  ];

  return {
    navigateToMessages: vi.fn().mockResolvedValue(undefined),
    getConversationPreviews: vi.fn().mockResolvedValue(previews),
    getAllVisibleConversations: vi.fn().mockResolvedValue([{ name: "Ana", platformId: "abc123" }]),
    scrollConversationList: vi.fn().mockResolvedValue(undefined),
    openConversation: vi.fn().mockResolvedValue(undefined),
    getOpenConversationName: vi.fn().mockResolvedValue("Ana"),
    readMessages: vi.fn().mockResolvedValue(messages),
    typeMessage: vi.fn().mockResolvedValue(true),
    confirmSend: vi.fn().mockResolvedValue(true),
    sendMessage: vi.fn().mockResolvedValue(true),
    goBackToConversationList: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AnalysisSession", () => {
  it("syncs conversations, exports, and runs AI analysis", async () => {
    const chatPage = createChatPageMock();
    const store: ConversationStorePort = {
      load: vi.fn().mockReturnValue({ name: "Ana", platformId: "abc123", messages: [] }),
      save: vi.fn(),
      merge: vi.fn(),
      listAll: vi.fn().mockReturnValue([{ name: "Ana", platformId: "abc123" }]),
      exportHistorical: vi.fn(),
    };
    const unmatchStore: UnmatchStorePort = {
      save: vi.fn(),
      loadAll: vi.fn().mockReturnValue([]),
      isUnmatched: vi.fn().mockReturnValue(false),
    };
    const instagramStore: InstagramStorePort = {
      save: vi.fn(),
      loadAll: vi.fn().mockReturnValue([]),
      hasInstagram: vi.fn().mockReturnValue(false),
    };
    const analyzer = {
      generateReport: vi.fn().mockResolvedValue({
        generatedAt: new Date().toISOString(),
        metrics: { totalConversations: 1 },
        reportMarkdown: "## Resumen\nTodo bien",
      }),
    };

    const session = new AnalysisSession(chatPage, store, {
      conversationStore: store,
      unmatchStore,
      instagramStore,
      systemConversations: new Set(),
    }, analyzer as never);

    await session.run();

    expect(store.exportHistorical).toHaveBeenCalled();
    expect(analyzer.generateReport).toHaveBeenCalled();
  });
});
