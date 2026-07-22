import type { Page } from "playwright";
import { BumblePage } from "../infrastructure/browser/bumble/bumble-page.js";
import { BumbleChatPage } from "../infrastructure/browser/bumble/bumble-chat-page.js";
import { TinderPage } from "../infrastructure/browser/tinder/tinder-page.js";
import { TinderChatPage } from "../infrastructure/browser/tinder/tinder-chat-page.js";
import type { ChatPagePort, Platform, SwipePagePort } from "../domain/types.js";

export function createSwipePage(platform: Platform, page: Page): SwipePagePort {
  switch (platform) {
    case "tinder":
      return new TinderPage(page);
    case "bumble":
      return new BumblePage(page);
  }
}

export function createChatPage(platform: Platform, page: Page): ChatPagePort {
  switch (platform) {
    case "tinder":
      return new TinderChatPage(page);
    case "bumble":
      return new BumbleChatPage(page);
  }
}
