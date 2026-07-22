import type {
  ChatMessage,
  Conversation,
  InstagramEntry,
  UnmatchEntry,
} from "./types.js";

export interface AnalysisMetrics {
  totalConversations: number;
  totalMessages: number;
  conversationsWithTheirReply: number;
  conversationsWithMyReply: number;
  replyRatePercent: number;
  avgMessagesPerConversation: number;
  conversationsWhereILastSpoke: number;
  conversationsWhereTheyLastSpoke: number;
  unmatchCount: number;
  unmatchAfterMyMessage: number;
  unmatchAfterTheirMessage: number;
  instagramCount: number;
  instagramConversionPercent: number;
  emptyConversations: number;
}

export function computeAnalysisMetrics(
  conversations: Conversation[],
  unmatches: UnmatchEntry[],
  instagrams: InstagramEntry[],
): AnalysisMetrics {
  const withMessages = conversations.filter((c) => c.messages.length > 0);
  const totalMessages = withMessages.reduce((sum, c) => sum + c.messages.length, 0);
  const conversationsWithTheirReply = withMessages.filter((c) =>
    c.messages.some((m) => m.sender === "them"),
  ).length;
  const conversationsWithMyReply = withMessages.filter((c) =>
    c.messages.some((m) => m.sender === "me"),
  ).length;

  let conversationsWhereILastSpoke = 0;
  let conversationsWhereTheyLastSpoke = 0;

  for (const conv of withMessages) {
    const last = conv.messages[conv.messages.length - 1];

    if (last.sender === "me") {
      conversationsWhereILastSpoke++;
    } else {
      conversationsWhereTheyLastSpoke++;
    }
  }

  const replyRatePercent = withMessages.length > 0
    ? Math.round((conversationsWithTheirReply / withMessages.length) * 100)
    : 0;

  const instagramKeys = new Set(
    instagrams.map((e) => (e.platformId || e.name).toLowerCase()),
  );
  const conversationsWithInstagram = withMessages.filter((c) =>
    instagramKeys.has((c.platformId || c.name).toLowerCase()),
  ).length;

  const instagramConversionPercent = withMessages.length > 0
    ? Math.round((conversationsWithInstagram / withMessages.length) * 100)
    : 0;

  return {
    totalConversations: conversations.length,
    totalMessages,
    conversationsWithTheirReply,
    conversationsWithMyReply,
    replyRatePercent,
    avgMessagesPerConversation: withMessages.length > 0
      ? Math.round((totalMessages / withMessages.length) * 10) / 10
      : 0,
    conversationsWhereILastSpoke,
    conversationsWhereTheyLastSpoke,
    unmatchCount: unmatches.length,
    unmatchAfterMyMessage: unmatches.filter((u) => u.lastMessageSender === "me").length,
    unmatchAfterTheirMessage: unmatches.filter((u) => u.lastMessageSender === "them").length,
    instagramCount: instagrams.length,
    instagramConversionPercent,
    emptyConversations: conversations.length - withMessages.length,
  };
}

export function pickConversationSamples(
  conversations: Conversation[],
  maxSamples: number,
): Conversation[] {
  const withMessages = conversations
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => b.messages.length - a.messages.length);

  return withMessages.slice(0, maxSamples);
}

export function formatConversationSample(conv: Conversation, maxMessages = 8): string {
  const recent = conv.messages.slice(-maxMessages);
  const lines = recent.map((m) => formatMessageLine(m));

  return `### ${conv.name} (${conv.messages.length} msgs)\n${lines.join("\n")}`;
}

function formatMessageLine(msg: ChatMessage): string {
  const who = msg.sender === "me" ? "Kevin" : "Ella";

  return `${who}: ${msg.content.substring(0, 200)}`;
}
