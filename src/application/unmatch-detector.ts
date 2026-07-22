import type {
  ConversationStorePort,
  InstagramStorePort,
  UnmatchStorePort,
  VisibleConversation,
} from "../domain/types.js";

export interface UnmatchDetectorDeps {
  conversationStore: ConversationStorePort;
  unmatchStore: UnmatchStorePort;
  instagramStore: InstagramStorePort;
  systemConversations: Set<string>;
}

export function detectUnmatches(
  visible: VisibleConversation[],
  deps: UnmatchDetectorDeps,
  logPrefix = "[Unmatch]",
): number {
  const known = deps.conversationStore.listAll();

  if (known.length === 0) {
    return 0;
  }

  const visibleIds = new Set(visible.map((v) => v.platformId.toLowerCase()).filter(Boolean));
  const visibleNames = new Set(visible.map((v) => v.name.toLowerCase()));
  let detected = 0;

  for (const entry of known) {
    if (deps.systemConversations.has(entry.name.toLowerCase())) {
      continue;
    }

    const key = entry.platformId || entry.name;

    if (deps.unmatchStore.isUnmatched(key)) {
      continue;
    }

    const isVisible = entry.platformId
      ? visibleIds.has(entry.platformId.toLowerCase())
      : visibleNames.has(entry.name.toLowerCase());

    if (isVisible) {
      continue;
    }

    const conversation = deps.conversationStore.load(entry.platformId, entry.name);
    const lastMsg = conversation.messages[conversation.messages.length - 1];

    deps.unmatchStore.save({
      name: entry.name,
      platformId: entry.platformId,
      detectedAt: new Date().toISOString(),
      lastMessageSender: lastMsg?.sender ?? "me",
      lastMessageContent: lastMsg?.content.substring(0, 200) ?? "",
      totalMessages: conversation.messages.length,
      hadInstagram: deps.instagramStore.hasInstagram(key),
    });

    console.log(
      `${logPrefix} unmatch detected: ${entry.name} (${conversation.messages.length} msgs, last by ${lastMsg?.sender ?? "unknown"})`,
    );
    detected++;
  }

  if (detected > 0) {
    console.log(`${logPrefix} total unmatches detected: ${detected}`);
  }

  return detected;
}
