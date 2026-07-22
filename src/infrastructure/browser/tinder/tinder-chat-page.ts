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

export class TinderChatPage implements ChatPagePort {
  constructor(private readonly page: Page) {}

  async navigateToMessages(): Promise<void> {
    const tabSelectors = [
      CHAT_SELECTORS.messagesTabEn,
      CHAT_SELECTORS.messagesTabPt,
      CHAT_SELECTORS.messagesTabFallback,
    ];

    for (const selector of tabSelectors) {
      try {
        const tab = this.page.locator(selector).first();

        if (await tab.isVisible({ timeout: 2_000 })) {
          await tab.click();
          await this.page.waitForTimeout(SETTLE_MS);

          console.log("[ChatPage] Clicked messages tab.");

          return;
        }
      } catch {
        continue;
      }
    }

    const hasConvos = await this.page
      .locator(CHAT_SELECTORS.conversationLink)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (hasConvos) {
      console.log("[ChatPage] Conversations already visible in sidebar.");

      return;
    }

    throw new Error(
      "messages tab not found: could not locate Messages/Mensagens button or conversation list",
    );
  }

  async getConversationPreviews(): Promise<ConversationPreview[]> {
    await this.page.waitForTimeout(1_000);

    const previews = await this.page.evaluate(`(() => {
      const results = [];

      function extractId(href) {
        const m = (href || "").match(/\\/app\\/messages\\/([^/?#]+)/);
        return m ? m[1] : "";
      }

      const links = document.querySelectorAll('a[href*="/app/messages/"]');

      if (links.length > 0) {
        let idx = 0;

        for (const item of links) {
          const platformId = extractId(item.getAttribute("href"));
          const spans = item.querySelectorAll("span");
          let name = "";

          for (const span of spans) {
            const text = (span.textContent || "").trim();

            if (text.length >= 2 && text.length <= 40 && !name) {
              name = text;
              break;
            }
          }

          if (name) {
            results.push({ name, platformId, index: idx });
          }

          idx++;
        }

        return results;
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
        const m = (href || "").match(/\\/app\\/messages\\/([^/?#]+)/);
        return m ? m[1] : "";
      }

      function collect() {
        const links = document.querySelectorAll('a[href*="/app/messages/"]');
        for (const item of links) {
          const platformId = extractId(item.getAttribute("href"));
          if (!platformId || seen.has(platformId)) continue;
          const spans = item.querySelectorAll("span");
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
        const links = document.querySelectorAll('a[href*="/app/messages/"]');
        if (links.length === 0) return null;
        let container = links[0].parentElement;
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
      const links = document.querySelectorAll('a[href*="/app/messages/"]');
      if (links.length === 0) return;

      let container = links[0].parentElement;
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
        .locator(`a[href*="/app/messages/${preview.platformId}"]`)
        .first();
      const visible = await link.isVisible({ timeout: 3_000 }).catch(() => false);

      if (visible) {
        await link.click();
        await this.waitForChatView();

        return;
      }

      console.log(
        `[ChatPage] platformId ${preview.platformId} not visible, falling back to index ${preview.index}`,
      );
    }

    await this.openConversationByIndex(preview.index);
  }

  private async openConversationByIndex(index: number): Promise<void> {
    const links = this.page.locator(CHAT_SELECTORS.conversationLink);
    const count = await links.count();

    if (index >= count) {
      throw new Error(
        `conversation index ${index} out of range (${count} available)`,
      );
    }

    await links.nth(index).click();
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
        "[ChatPage] Textarea not found after click. Checking URL...",
      );
    }

    await this.page.waitForTimeout(SETTLE_MS);
  }

  async getOpenConversationName(): Promise<string> {
    const name = await this.page.evaluate(`(() => {
      const candidates = [
        document.querySelector('main h1'),
        document.querySelector('main [class*="Typs(display-1-strong)"]'),
        document.querySelector('main header span'),
        document.querySelector('[class*="chatHeader"] span'),
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

    await this.page.evaluate(`(async () => {
      const textareas = document.querySelectorAll("textarea");
      if (textareas.length === 0) return;

      let chatTextarea = null;
      for (const ta of textareas) {
        const ph = (ta.placeholder || "").toLowerCase();
        if (ph.includes("message") || ph.includes("mensagem") || ph.includes("type")) {
          chatTextarea = ta;
          break;
        }
      }
      if (!chatTextarea) chatTextarea = textareas[textareas.length - 1];

      let chatPanel = chatTextarea;
      for (let i = 0; i < 15; i++) {
        if (!chatPanel.parentElement) break;
        chatPanel = chatPanel.parentElement;
        const rect = chatPanel.getBoundingClientRect();
        if (rect.height > 400 && rect.width > 300) break;
      }

      const textareaRect = chatTextarea.getBoundingClientRect();
      let msgContainer = null;
      const children = chatPanel.querySelectorAll("*");
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        const style = window.getComputedStyle(child);
        const isScrollable = style.overflowY === "auto" || style.overflowY === "scroll";
        if (isScrollable && rect.bottom <= textareaRect.top + 50 && rect.height > 100 && rect.width > 200) {
          if (!msgContainer || rect.height > msgContainer.getBoundingClientRect().height) {
            msgContainer = child;
          }
        }
      }
      if (!msgContainer) return;

      msgContainer.scrollTop = 0;
      await new Promise(r => setTimeout(r, 400));

      let prevHeight = 0;
      let stableRounds = 0;
      const maxRounds = 30;

      for (let round = 0; round < maxRounds && stableRounds < 3; round++) {
        msgContainer.scrollTop = msgContainer.scrollHeight;
        await new Promise(r => setTimeout(r, 450));

        const height = msgContainer.scrollHeight;

        if (height === prevHeight) {
          stableRounds++;
        } else {
          stableRounds = 0;
          prevHeight = height;
        }
      }
    })()`);

    await this.page.waitForTimeout(500);

    const scrapedAt = new Date();

    const raw = await this.page.evaluate(wrapDomEvaluateScript(`
      const messages = [];

      const textareas = document.querySelectorAll("textarea");
      if (textareas.length === 0) return messages;

      let chatTextarea = null;
      for (const ta of textareas) {
        const ph = (ta.placeholder || "").toLowerCase();
        if (ph.includes("message") || ph.includes("mensagem") || ph.includes("type")) {
          chatTextarea = ta;
          break;
        }
      }
      if (!chatTextarea) chatTextarea = textareas[textareas.length - 1];

      let chatPanel = chatTextarea;
      for (let i = 0; i < 15; i++) {
        if (!chatPanel.parentElement) break;
        chatPanel = chatPanel.parentElement;
        const rect = chatPanel.getBoundingClientRect();
        if (rect.height > 400 && rect.width > 300) break;
      }

      const textareaRect = chatTextarea.getBoundingClientRect();
      let msgContainer = null;
      const children = chatPanel.querySelectorAll("*");
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        const style = window.getComputedStyle(child);
        const isScrollable = style.overflowY === "auto" || style.overflowY === "scroll";
        if (isScrollable && rect.bottom <= textareaRect.top + 50 && rect.height > 100 && rect.width > 200) {
          if (!msgContainer || rect.height > msgContainer.getBoundingClientRect().height) {
            msgContainer = child;
          }
        }
      }
      if (!msgContainer) msgContainer = chatPanel;

      const containerRect = msgContainer.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;

      const allSpans = msgContainer.querySelectorAll("span, p");
      const seen = new Set();

      var metadataPattern = /^(Sent|Delivered|Read|Enviado|Entregue|Lido|GIF|SEND|Send|Enviar|Today|Yesterday|Hoje|Ontem|You|Reply|Tap to)$/i;
      var timePattern = /^\\d{1,2}:\\d{2}(\\s*(AM|PM))?$/i;
      var sentAtPattern = /^Sent at \\d/i;
      var nameColonPattern = /^.{1,30}:$/;
      var matchHeaderPattern = /^You matched with/i;

      for (const el of allSpans) {
        if (el.childElementCount > 0) continue;

        const text = (el.innerText || el.textContent || "").trim();
        if (!text || text.length < 1 || text.length > 5000) continue;

        if (metadataPattern.test(text)) continue;
        if (timePattern.test(text)) continue;
        if (sentAtPattern.test(text)) continue;
        if (nameColonPattern.test(text)) continue;
        if (matchHeaderPattern.test(text)) continue;

        let insideSidebar = false;
        let walker = el;
        for (let p = 0; p < 8; p++) {
          if (!walker) break;
          if (walker.tagName === "A" || walker.tagName === "NAV") {
            insideSidebar = true;
            break;
          }
          walker = walker.parentElement;
        }
        if (insideSidebar) continue;

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

    // Check for debug output
    if (raw.length === 1 && raw[0].content.startsWith("__DEBUG__:")) {
      console.log(`[ChatPage] ${raw[0].content}`);

      return [];
    }

    return mapRawDomMessages(raw, scrapedAt);
  }

  async typeMessage(message: string): Promise<boolean> {
    try {
      const textarea = this.page.locator(CHAT_SELECTORS.chatTextarea).first();
      const isVisible = await textarea.isVisible();

      if (!isVisible) {
        console.log("[ChatPage] Textarea not visible, cannot type message");

        return false;
      }

      await textarea.click();
      await this.page.waitForTimeout(300);
      await textarea.pressSequentially(message, { delay: TYPE_DELAY_MS });
      await this.page.waitForTimeout(500);

      return true;
    } catch (error) {
      console.error(
        `[ChatPage] type message: ${error instanceof Error ? error.message : error}`,
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
        `[ChatPage] confirm send: ${error instanceof Error ? error.message : error}`,
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
    const hasConvos = await this.page
      .locator(CHAT_SELECTORS.conversationLink)
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (hasConvos) {
      return;
    }

    await this.navigateToMessages();
  }
}
