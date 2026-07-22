import type {
  ChatBreakPort,
  ChatConfig,
  ChatGeneratorPort,
  ChatMessage,
  ChatSessionConfig,
  ConversationPreview,
  ConversationStorePort,
  InstagramStorePort,
  PersonalContextStorePort,
  ChatPagePort,
  UnmatchStorePort,
} from "../domain/types.js";
import { detectUnmatches } from "./unmatch-detector.js";
import { isAiConsultationError } from "../infrastructure/ai/ai-error.js";

const INSTAGRAM_PATTERN =
  /(?:@([a-zA-Z0-9_.]{1,30})\b)|(?:instagram\.com\/([a-zA-Z0-9_.]{1,30}))|(?:(?:insta|ig)\s*(?:é|:)\s*@?([a-zA-Z0-9_.]{1,30}))/i;

export interface ChatRunResult {
  reason: "aborted" | "completed";
  cyclesCompleted: number;
  repliesSent: number;
}

export class ChatSession implements ChatBreakPort {
  private aborted = false;
  private cyclesCompleted = 0;
  private totalRepliesSent = 0;

  constructor(
    private readonly chatPage: ChatPagePort,
    private readonly chatGenerator: ChatGeneratorPort,
    private readonly conversationStore: ConversationStorePort,
    private readonly contextStore: PersonalContextStorePort,
    private readonly instagramStore: InstagramStorePort,
    private readonly unmatchStore: UnmatchStorePort,
    private readonly config: ChatConfig,
    private readonly sessionConfig: ChatSessionConfig,
  ) {}

  abort(): void {
    this.aborted = true;
  }

  async run(): Promise<ChatRunResult> {
    console.log("[Chat] Starting chat session (loop mode)...");
    console.log(
      `[Chat] Mode: ${this.config.chatReplyAll ? "reply all" : "reply latest only"} | ` +
        `Dry run: ${this.config.chatDryRun ? "ON (read only)" : "OFF"} | ` +
        `Model: ${this.config.chatModel} | ` +
        `Send delay: ${this.config.chatSendDelayS}s`,
    );

    let cycle = 1;

    while (!this.aborted) {
      console.log(`\n[Chat] ═══ Cycle ${cycle} started at ${new Date().toLocaleTimeString()} ═══`);

      await this.runCycle();
      this.cyclesCompleted++;
      cycle++;

      if (this.aborted) {
        break;
      }

      const range = this.config.chatCycleMaxMin - this.config.chatCycleMinMin;
      const waitMinutes = this.config.chatCycleMinMin + Math.floor(Math.random() * (range + 1));
      const nextRun = new Date(Date.now() + waitMinutes * 60_000);

      console.log(
        `[Chat] Next check in ${waitMinutes} min (at ${nextRun.toLocaleTimeString()}).`,
      );

      await this.sleepWithAbort(waitMinutes * 60_000);
    }

    console.log("[Chat] Session stopped.");

    return {
      reason: this.aborted ? "aborted" : "completed",
      cyclesCompleted: this.cyclesCompleted,
      repliesSent: this.totalRepliesSent,
    };
  }

  async runCycle(): Promise<void> {
    try {
      await this.chatPage.navigateToMessages();

      await this.detectUnmatches();

      const previews = await this.waitForConversations();

      if (previews.length === 0) {
        console.log("[Chat] No conversations found.");

        return;
      }

      console.log(`[Chat] Found ${previews.length} conversations.`);

      const limit = Math.min(previews.length, this.config.chatMaxConversations);
      let repliesSent = 0;

      for (let i = 0; i < limit && !this.aborted; i++) {
        const preview = previews[i];

        try {
          await this.chatPage.openConversation(preview);
          const processed = await this.processConversation(preview, i + 1, limit);

          if (processed) {
            repliesSent++;
            this.totalRepliesSent++;

            if (!this.config.chatReplyAll && !this.config.chatDryRun) {
              console.log("[Chat] CHAT_REPLY_ALL=false, stopping.");
              break;
            }
          }
        } catch (error) {
          if (isAiConsultationError(error)) {
            throw error;
          }

          console.error(
            `[Chat] ${preview.name}: ${error instanceof Error ? error.message : error}`,
          );
        }

        await this.chatPage.goBackToConversationList();
      }

      console.log(
        `\n[Chat] Cycle complete. Replies sent: ${repliesSent}`,
      );
    } catch (error) {
      if (isAiConsultationError(error)) {
        throw error;
      }

      console.error(
        `[Chat] cycle: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async detectUnmatches(): Promise<void> {
    try {
      const visible = await this.chatPage.getAllVisibleConversations();

      detectUnmatches(visible, {
        conversationStore: this.conversationStore,
        unmatchStore: this.unmatchStore,
        instagramStore: this.instagramStore,
        systemConversations: this.sessionConfig.systemConversations,
      }, "[Chat]");
    } catch (error) {
      console.error(
        `[Chat] unmatch detection: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private isSystemConversation(name: string, messages: ChatMessage[]): boolean {
    if (this.sessionConfig.systemConversations.has(name.toLowerCase().trim())) {
      return true;
    }

    return messages.some((m) =>
      this.sessionConfig.systemMessagePatterns.some((pattern) => pattern.test(m.content)),
    );
  }

  private async processConversation(
    preview: ConversationPreview,
    current: number,
    total: number,
  ): Promise<boolean> {
    const { name, platformId } = preview;
    const freshMessages = await this.chatPage.readMessages();

    if (freshMessages.length === 0) {
      return false;
    }

    if (this.isSystemConversation(name, freshMessages)) {
      console.log(`[Chat] ── ${name} (${current}/${total}) - system/promo conversation, skipped`);

      return false;
    }

    const conversation = this.conversationStore.merge(platformId, name, freshMessages);

    this.detectInstagram(platformId, name, conversation.messages);

    const igKey = platformId || name;

    if (this.instagramStore.hasInstagram(igKey)) {
      console.log(`[Chat] ── ${name} (${current}/${total}) - instagram already obtained, done`);

      return false;
    }

    const lastMessage = conversation.messages[conversation.messages.length - 1];

    if (lastMessage.sender === "me") {
      console.log(`[Chat] ── ${name} (${current}/${total}) - already replied`);

      return false;
    }

    const personalContext = this.contextStore.loadKnownContext();
    const result = await this.chatGenerator.generateReply(
      conversation,
      personalContext,
    );

    if (!result.message) {
      console.log(`[Chat] ── ${name} (${current}/${total}) - AI returned empty, skipped`);

      return false;
    }

    if (this.isDuplicateMessage(result.message, conversation.messages)) {
      console.log(`[Chat] ── ${name} (${current}/${total}) - duplicate message detected, skipped`);

      return false;
    }

    for (const q of result.unknownQuestions) {
      this.contextStore.logUnknownQuestion(q, name);
    }

    console.log(`\n[Chat] ── ${name} (${current}/${total})`);
    console.log(`[Chat]    ${name}: ${lastMessage.content.substring(0, 120)}${lastMessage.content.length > 120 ? "..." : ""}`);
    console.log(`[Chat]    ${this.sessionConfig.personaName}: ${result.message}`);

    if (this.config.chatDryRun) {
      console.log(`[Chat]    [DRY RUN] Not sent.`);

      return true;
    }

    const typed = await this.chatPage.typeMessage(result.message);

    if (!typed) {
      console.log(`[Chat]    Failed to type message.`);

      return false;
    }

    if (this.config.chatSendDelayS > 0) {
      console.log(
        `[Chat]    Typed. Sending in ${this.config.chatSendDelayS}s...`,
      );
      await this.countdown(this.config.chatSendDelayS);
    }

    if (this.aborted) {
      console.log(`[Chat]    Aborted before sending.`);

      return false;
    }

    const freshCheck = await this.chatPage.readMessages();
    const lastFresh = freshCheck[freshCheck.length - 1];

    if (lastFresh && lastFresh.sender === "me") {
      console.log(`[Chat]    Stale state: last message is now ours, aborting send.`);

      return false;
    }

    const sent = await this.chatPage.confirmSend();

    if (sent) {
      console.log(`[Chat]    Sent.`);

      const updatedMessages = [
        ...conversation.messages,
        {
          sender: "me" as const,
          content: result.message,
          timestamp: new Date(),
        },
      ];

      this.conversationStore.save({ name, platformId, messages: updatedMessages });

      return true;
    }

    console.log(`[Chat]    Failed to send.`);

    return false;
  }

  private isDuplicateMessage(newMessage: string, history: ChatMessage[]): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-záàâãéêíóôõúç\s]/gi, "").trim();
    const newNorm = normalize(newMessage);

    return history
      .filter((m) => m.sender === "me")
      .some((m) => {
        const existingNorm = normalize(m.content);

        return existingNorm === newNorm || existingNorm.includes(newNorm) || newNorm.includes(existingNorm);
      });
  }

  private detectInstagram(platformId: string, name: string, messages: ChatMessage[]): void {
    const key = platformId || name;

    if (this.instagramStore.hasInstagram(key)) {
      return;
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.sender !== "them") {
        continue;
      }

      const explicit = this.extractExplicitHandle(msg.content);

      if (explicit) {
        this.saveInstagram(platformId, name, explicit);

        return;
      }

      const contextual = this.extractContextualHandle(msg.content, messages, i);

      if (contextual) {
        this.saveInstagram(platformId, name, contextual);

        return;
      }
    }
  }

  private saveInstagram(platformId: string, name: string, handle: string): void {
    this.instagramStore.save({
      name,
      platformId,
      handle,
      collectedAt: new Date().toISOString(),
      source: "them",
    });

    console.log(`[Chat]    Instagram captured: @${handle} (from ${name})`);
  }

  private extractExplicitHandle(text: string): string | null {
    const match = INSTAGRAM_PATTERN.exec(text);

    if (!match) {
      return null;
    }

    const handle = (match[1] || match[2] || match[3] || "").trim();

    if (!handle || handle.length < 2) {
      return null;
    }

    if (this.sessionConfig.selfHandles.has(handle.toLowerCase())) {
      return null;
    }

    return handle;
  }

  private extractContextualHandle(
    text: string,
    messages: ChatMessage[],
    currentIndex: number,
  ): string | null {
    const trimmed = text.trim();

    if (trimmed.length < 3 || trimmed.length > 35 || trimmed.includes(" ")) {
      return null;
    }

    if (!/^[a-zA-Z0-9_.]+$/.test(trimmed)) {
      return null;
    }

    if (this.sessionConfig.selfHandles.has(trimmed.toLowerCase())) {
      return null;
    }

    const precedingMyMessages = messages
      .slice(Math.max(0, currentIndex - 3), currentIndex)
      .filter((m) => m.sender === "me");

    const askedForInsta = precedingMyMessages.some((m) =>
      this.sessionConfig.instagramAskPattern.test(m.content),
    );

    if (!askedForInsta) {
      return null;
    }

    return trimmed;
  }

  private async waitForConversations(): Promise<ConversationPreview[]> {
    const maxWaitMs = 5 * 60 * 1_000;
    const retryIntervalMs = 15_000;
    let elapsed = 0;

    while (!this.aborted && elapsed < maxWaitMs) {
      const previews = await this.chatPage.getConversationPreviews();

      if (previews.length > 0) {
        return previews;
      }

      const remaining = Math.round((maxWaitMs - elapsed) / 1_000);

      console.log(
        `[Chat] No conversations found. Retrying in ${retryIntervalMs / 1_000}s... (${remaining}s left)`,
      );

      await sleep(retryIntervalMs);
      elapsed += retryIntervalMs;
    }

    return [];
  }

  private async countdown(seconds: number): Promise<void> {
    const interval = Math.min(seconds, 10);

    for (let remaining = seconds; remaining > 0 && !this.aborted; remaining -= interval) {
      const wait = Math.min(interval, remaining);

      await sleep(wait * 1_000);

      if (remaining - wait > 0) {
        console.log(`[Chat]    ${remaining - wait}s remaining...`);
      }
    }
  }

  private async sleepWithAbort(ms: number): Promise<void> {
    const checkInterval = 30_000;
    let elapsed = 0;

    while (elapsed < ms && !this.aborted) {
      const wait = Math.min(checkInterval, ms - elapsed);

      await sleep(wait);
      elapsed += wait;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
