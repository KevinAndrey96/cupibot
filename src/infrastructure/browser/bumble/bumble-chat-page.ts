import type { Page } from "playwright";
import type {
  ChatPagePort,
  ChatMessage,
  ConversationPreview,
  VisibleConversation,
} from "../../../domain/types.js";
import { CHAT_SELECTORS } from "./chat-selectors.js";
import {
  mapRawDomMessages,
  wrapDomEvaluateScript,
  type RawDomMessage,
} from "../chat-timestamp.js";

const SETTLE_MS = 2_000;
const TYPE_DELAY_MS = 30;

export class BumbleChatPage implements ChatPagePort {
  constructor(private readonly page: Page) {}

  async navigateToMessages(): Promise<void> {
    const tabSelectors = [
      CHAT_SELECTORS.messagesTabEn,
      CHAT_SELECTORS.messagesTabAlt,
      CHAT_SELECTORS.messagesTabFallback,
    ];

    for (const selector of tabSelectors) {
      try {
        const tab = this.page.locator(selector).first();

        if (await tab.isVisible({ timeout: 2_000 })) {
          await tab.click();
          await this.page.waitForTimeout(SETTLE_MS);

          console.log("[BumbleChatPage] Navigated to messages.");

          return;
        }
      } catch {
        continue;
      }
    }

    const hasConvos = await this.hasVisibleConversations();

    if (hasConvos) {
      console.log("[BumbleChatPage] Conversations already visible.");

      return;
    }

    throw new Error(
      "messages tab not found: could not locate Chats/Connections button or conversation list",
    );
  }

  async getConversationPreviews(): Promise<ConversationPreview[]> {
    await this.page.waitForTimeout(1_000);

    const previews = await this.page.evaluate(`(() => {
      const results = [];

      function extractId(href) {
        const m = (href || "").match(/\\/app\\/chat\\/([^/?#]+)/);
        return m ? m[1] : "";
      }

      const chatLinks = document.querySelectorAll('a[href*="/app/chat/"]');
      if (chatLinks.length > 0) {
        let idx = 0;
        for (const link of chatLinks) {
          const platformId = extractId(link.getAttribute("href"));
          const spans = link.querySelectorAll("span");
          let name = "";
          for (const span of spans) {
            const text = (span.textContent || "").trim();
            if (text.length >= 2 && text.length <= 40 && !name) {
              name = text;
              break;
            }
          }
          if (!name) {
            const nameEl = link.querySelector(".contact__name");
            if (nameEl) {
              name = (nameEl.textContent || "").trim();
            }
          }
          if (name) {
            results.push({ name, platformId, index: idx });
          }
          idx++;
        }
        return results;
      }

      const contacts = document.querySelectorAll(".contact");
      let idx = 0;
      for (const contact of contacts) {
        const nameEl = contact.querySelector(".contact__name");
        const name = nameEl ? (nameEl.textContent || "").trim() : "";
        const link = contact.closest("a");
        const platformId = link ? extractId(link.getAttribute("href")) : "";
        if (name && name.length >= 2) {
          results.push({ name, platformId, index: idx });
        }
        idx++;
      }

      return results;
    })()`) as ConversationPreview[];

    return previews;
  }

  async getAllVisibleConversations(): Promise<VisibleConversation[]> {
    await this.page.waitForTimeout(1_000);

    const results = await this.page.evaluate(`(async () => {
      const seen = new Map();
      const MAX_SCROLLS = 50;
      const SCROLL_PAUSE = 600;

      function extractId(href) {
        const m = (href || "").match(/\\/app\\/chat\\/([^/?#]+)/);
        return m ? m[1] : "";
      }

      function collect() {
        const chatLinks = document.querySelectorAll('a[href*="/app/chat/"]');
        for (const link of chatLinks) {
          const platformId = extractId(link.getAttribute("href"));
          if (!platformId || seen.has(platformId)) continue;
          const spans = link.querySelectorAll("span");
          for (const span of spans) {
            const text = (span.textContent || "").trim();
            if (text.length >= 2 && text.length <= 40) {
              seen.set(platformId, { name: text, platformId });
              break;
            }
          }
        }
      }

      function getScrollContainer() {
        const chatLinks = document.querySelectorAll('a[href*="/app/chat/"]');
        if (chatLinks.length === 0) return null;
        let container = chatLinks[0].parentElement;
        for (let i = 0; i < 10; i++) {
          if (!container || !container.parentElement) break;
          container = container.parentElement;
          const style = window.getComputedStyle(container);
          if (style.overflowY === "auto" || style.overflowY === "scroll") {
            return container;
          }
        }
        return null;
      }

      collect();

      const scrollEl = getScrollContainer();
      if (!scrollEl) return Array.from(seen.values());

      for (let i = 0; i < MAX_SCROLLS; i++) {
        const prevSize = seen.size;
        scrollEl.scrollTop = scrollEl.scrollHeight;
        await new Promise(r => setTimeout(r, SCROLL_PAUSE));
        collect();
        if (seen.size === prevSize) break;
      }

      scrollEl.scrollTop = 0;

      return Array.from(seen.values());
    })()`) as VisibleConversation[];

    return results;
  }

  async scrollConversationList(): Promise<void> {
    await this.page.evaluate(`(async () => {
      const chatLinks = document.querySelectorAll('a[href*="/app/chat/"]');
      if (chatLinks.length === 0) return;

      let container = chatLinks[0].parentElement;
      for (let i = 0; i < 10; i++) {
        if (!container || !container.parentElement) break;
        container = container.parentElement;
        const style = window.getComputedStyle(container);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          container.scrollTop += container.clientHeight;
          await new Promise(r => setTimeout(r, 800));
          return;
        }
      }
    })()`);
  }

  async openConversation(preview: ConversationPreview): Promise<void> {
    if (preview.platformId) {
      const link = this.page
        .locator(`a[href*="/app/chat/${preview.platformId}"]`)
        .first();
      const visible = await link.isVisible({ timeout: 3_000 }).catch(() => false);

      if (visible) {
        await link.click();
        await this.waitForChatView();

        return;
      }

      console.log(
        `[BumbleChatPage] platformId ${preview.platformId} not visible, falling back to index ${preview.index}`,
      );
    }

    await this.openConversationByIndex(preview.index);
  }

  private async openConversationByIndex(index: number): Promise<void> {
    const chatLinks = this.page.locator(CHAT_SELECTORS.conversationLink);
    let count = await chatLinks.count();

    if (count > 0) {
      if (index >= count) {
        throw new Error(
          `conversation index ${index} out of range (${count} available)`,
        );
      }

      await chatLinks.nth(index).click();
    } else {
      const contacts = this.page.locator(CHAT_SELECTORS.conversationItem);
      count = await contacts.count();

      if (index >= count) {
        throw new Error(
          `conversation index ${index} out of range (${count} available)`,
        );
      }

      await contacts.nth(index).click();
    }

    await this.waitForChatView();
  }

  private async waitForChatView(): Promise<void> {
    try {
      await this.page
        .locator(CHAT_SELECTORS.chatTextarea)
        .first()
        .waitFor({ state: "visible", timeout: 8_000 });
    } catch {
      console.log(
        "[BumbleChatPage] Textarea not found after click.",
      );
    }

    await this.page.waitForTimeout(SETTLE_MS);
  }

  async getOpenConversationName(): Promise<string> {
    const name = await this.page.evaluate(`(() => {
      const candidates = [
        document.querySelector(".messages-header__name"),
        document.querySelector(".chat-header__name"),
        document.querySelector("main header span"),
      ];

      for (const el of candidates) {
        const text = el ? (el.textContent || "").trim() : "";
        if (text && text.length >= 2 && text.length <= 40) {
          return text;
        }
      }

      return "";
    })()`) as string;

    return name;
  }

  async readMessages(): Promise<ChatMessage[]> {
    await this.page.waitForTimeout(1_500);

    const scrapedAt = new Date();

    const raw = await this.page.evaluate(wrapDomEvaluateScript(`
      const messages = [];

      // Strategy 1: use Bumble's .message elements with --in / --out modifiers
      const msgElements = document.querySelectorAll(".message");
      if (msgElements.length > 0) {
        for (const el of msgElements) {
          const text = (el.innerText || el.textContent || "").trim();
          if (!text || text.length < 1 || text.length > 5000) continue;

          const isIncoming = el.classList.contains("message--in");
          const isOutgoing = el.classList.contains("message--out");

          if (!isIncoming && !isOutgoing) continue;

          var timeLabel = null;
          var timeEl = el.querySelector("time[datetime], .message__time, .message-time");
          if (timeEl) {
            timeLabel = timeEl.getAttribute("datetime") || (timeEl.textContent || "").trim() || null;
          }
          if (!timeLabel) {
            timeLabel = extractTimeLabel(el);
          }

          messages.push({
            sender: isOutgoing ? "me" : "them",
            content: text,
            timeLabel: timeLabel,
          });
        }
        return messages;
      }

      // Strategy 2: fallback using position-based detection (similar to Tinder)
      const textareas = document.querySelectorAll("textarea");
      if (textareas.length === 0) return messages;

      let chatTextarea = textareas[textareas.length - 1];
      for (const ta of textareas) {
        const ph = (ta.placeholder || "").toLowerCase();
        if (ph.includes("message") || ph.includes("type")) {
          chatTextarea = ta;
          break;
        }
      }

      let chatPanel = chatTextarea;
      for (let i = 0; i < 15; i++) {
        if (!chatPanel.parentElement) break;
        chatPanel = chatPanel.parentElement;
        const rect = chatPanel.getBoundingClientRect();
        if (rect.height > 400 && rect.width > 300) break;
      }

      const containerRect = chatPanel.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;

      const allSpans = chatPanel.querySelectorAll("span, p");
      const seen = new Set();

      var metadataPattern = /^(Sent|Delivered|Read|GIF|Today|Yesterday|You|Reply|Tap to)$/i;
      var timePattern = /^\\d{1,2}:\\d{2}(\\s*(AM|PM))?$/i;

      for (const el of allSpans) {
        if (el.childElementCount > 0) continue;

        const text = (el.innerText || el.textContent || "").trim();
        if (!text || text.length < 1 || text.length > 5000) continue;
        if (metadataPattern.test(text)) continue;
        if (timePattern.test(text)) continue;
        if (seen.has(text)) continue;
        seen.add(text);

        let bubble = el;
        for (let p = 0; p < 6; p++) {
          if (!bubble.parentElement) break;
          const bRect = bubble.parentElement.getBoundingClientRect();
          if (bRect.width > containerRect.width * 0.9) break;
          bubble = bubble.parentElement;
        }

        const bubbleRect = bubble.getBoundingClientRect();
        const bubbleCenter = bubbleRect.left + bubbleRect.width / 2;
        const isMine = bubbleCenter > centerX;

        messages.push({
          sender: isMine ? "me" : "them",
          content: text,
          timeLabel: extractTimeLabel(bubble),
        });
      }

      return messages;
    `)) as RawDomMessage[];

    return mapRawDomMessages(raw, scrapedAt);
  }

  async typeMessage(message: string): Promise<boolean> {
    try {
      const textarea = this.page.locator(CHAT_SELECTORS.chatTextarea).first();
      const isVisible = await textarea.isVisible();

      if (!isVisible) {
        console.log("[BumbleChatPage] Textarea not visible, cannot type message");

        return false;
      }

      await textarea.click();
      await this.page.waitForTimeout(300);
      await textarea.pressSequentially(message, { delay: TYPE_DELAY_MS });
      await this.page.waitForTimeout(500);

      return true;
    } catch (error) {
      console.error(
        `[BumbleChatPage] type message: ${error instanceof Error ? error.message : error}`,
      );

      return false;
    }
  }

  async confirmSend(): Promise<boolean> {
    try {
      const submitBtn = this.page
        .locator(CHAT_SELECTORS.chatSendButton)
        .first();
      const btnVisible = await submitBtn.isVisible().catch(() => false);

      if (btnVisible) {
        await submitBtn.click();
      } else {
        await this.page.keyboard.press("Enter");
      }

      await this.page.waitForTimeout(1_000);

      return true;
    } catch (error) {
      console.error(
        `[BumbleChatPage] confirm send: ${error instanceof Error ? error.message : error}`,
      );

      return false;
    }
  }

  async sendMessage(message: string): Promise<boolean> {
    const typed = await this.typeMessage(message);

    if (!typed) {
      return false;
    }

    return this.confirmSend();
  }

  async goBackToConversationList(): Promise<void> {
    const hasConvos = await this.hasVisibleConversations();

    if (hasConvos) {
      return;
    }

    await this.navigateToMessages();
  }

  private async hasVisibleConversations(): Promise<boolean> {
    const chatLinks = await this.page
      .locator(CHAT_SELECTORS.conversationLink)
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (chatLinks) {
      return true;
    }

    const contacts = await this.page
      .locator(CHAT_SELECTORS.conversationItem)
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    return contacts;
  }
}
