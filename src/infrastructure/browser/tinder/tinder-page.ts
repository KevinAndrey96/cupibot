import type { Page } from "playwright";
import type { SwipePagePort, ProfileInfo } from "../../../domain/types.js";
import { SELECTORS } from "./selectors.js";

const TINDER_URL = "https://tinder.com/app/recs";
const NAV_TIMEOUT_MS = 30_000;
const SHORT_TIMEOUT_MS = 2_000;
const PHOTO_NAV_DELAY_MS = 600;
const MAX_PHOTOS = 6;

export class TinderPage implements SwipePagePort {
  constructor(private readonly page: Page) {}

  async navigate(): Promise<void> {
    await this.page.goto(TINDER_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
  }

  async isOnSwipeScreen(): Promise<boolean> {
    try {
      const url = this.page.url();

      if (!url.includes("tinder.com")) {
        return false;
      }

      const hasCards = await this.findAnyVisible([
        SELECTORS.recsCardBoard,
        SELECTORS.gamepadContainer,
        SELECTORS.profileCard,
      ]);

      return hasCards;
    } catch {
      return false;
    }
  }

  async clickLike(): Promise<void> {
    await this.ensureFocus();
    await this.page.keyboard.press("ArrowRight");
  }

  async clickPass(): Promise<void> {
    await this.ensureFocus();
    await this.page.keyboard.press("ArrowLeft");
  }

  async hasMatchPopup(): Promise<boolean> {
    return this.findAnyVisible([
      SELECTORS.matchText,
      SELECTORS.matchMessageInput,
    ]);
  }

  async sendMatchMessage(message: string): Promise<boolean> {
    try {
      const input = this.page.locator(SELECTORS.matchMessageInput).first();
      const isVisible = await input.isVisible();

      if (!isVisible) {
        return false;
      }

      await input.click();
      await this.page.waitForTimeout(300);
      await input.fill(message);
      await this.page.waitForTimeout(500);

      const sendBtn = this.page.locator(SELECTORS.matchSendButton).first();
      const sendVisible = await sendBtn.isVisible();

      if (sendVisible) {
        await sendBtn.click();
        await this.page.waitForTimeout(1_000);

        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async hasPopup(): Promise<boolean> {
    const popupIndicators = [
      SELECTORS.matchDialog,
      SELECTORS.matchText,
      SELECTORS.noThanksButton,
      SELECTORS.maybeLaterButton,
      SELECTORS.notNowButton,
      SELECTORS.notInterestedButton,
      SELECTORS.keepSwipingButton,
      SELECTORS.backToTinderButton,
    ];

    return this.findAnyVisible(popupIndicators);
  }

  async dismissPopup(): Promise<void> {
    const dismissSelectors = [
      SELECTORS.keepSwipingButton,
      SELECTORS.backToTinderButton,
      SELECTORS.notInterestedButton,
      SELECTORS.noThanksButton,
      SELECTORS.maybeLaterButton,
      SELECTORS.notNowButton,
      SELECTORS.closeButton,
    ];

    for (const selector of dismissSelectors) {
      try {
        const locator = this.page.locator(selector).first();
        const isVisible = await locator.isVisible();

        if (isVisible) {
          await locator.click({ timeout: SHORT_TIMEOUT_MS });

          return;
        }
      } catch {
        continue;
      }
    }

    await this.page.keyboard.press("Escape");
  }

  async hasOutOfLikes(): Promise<boolean> {
    try {
      return this.findAnyVisible([
        SELECTORS.outOfLikesText,
        SELECTORS.getMoreLikesButton,
      ]);
    } catch {
      return false;
    }
  }

  async extractProfileInfo(): Promise<ProfileInfo | null> {
    try {
      // 1. Capture photos first while on the swipe card view
      const photos = await this.captureAllPhotos();

      // 2. Open full profile for bio extraction
      await this.ensureFocus();
      await this.page.keyboard.press("ArrowUp");
      await this.page.waitForTimeout(1000);

      const textInfo = await this.extractProfileText();

      await this.simulateProfileBrowsing();

      // 3. Close profile back to swipe view
      await this.page.keyboard.press("ArrowDown");
      await this.page.waitForTimeout(500);

      // 4. Restore focus to the card area for swipe to work
      await this.ensureFocus();

      if (!textInfo) {
        return { name: "", age: "", bio: "", raw: "", photos };
      }

      return { ...textInfo, photos };
    } catch {
      try {
        await this.page.keyboard.press("Escape");
        await this.page.waitForTimeout(300);
        await this.ensureFocus();
      } catch {
        // ignore
      }

      return null;
    }
  }

  private async ensureFocus(): Promise<void> {
    try {
      await this.page.mouse.click(640, 400);
      await this.page.waitForTimeout(200);
    } catch {
      // ignore
    }
  }

  /**
   * Extracts profile text from the open profile view.
   * The H1 with Typs(display-1-strong) contains two child SPANs:
   *   - first SPAN (Pend(8px)): the name
   *   - second SPAN (Typs(display-2-strong)): the age
   */
  private async extractProfileText(): Promise<{
    name: string;
    age: string;
    bio: string;
    raw: string;
  } | null> {
    const result = await this.page.evaluate(`(() => {
      let name = "";
      let age = "";

      // The H1 header holds both name and age as child SPANs
      const h1 = document.querySelector('h1[class*="Typs(display-1-strong)"]');
      if (h1) {
        const spans = h1.querySelectorAll(":scope > span");
        for (const span of spans) {
          const text = (span.textContent || "").trim();
          if (!text) continue;
          const cls = span.className || "";

          // Age SPAN has Typs(display-2-strong) and contains only digits
          if (cls.includes("Typs(display-2-strong)") && /^\\d{2}$/.test(text)) {
            age = text;
          } else if (!name && text.length >= 2 && text.length <= 30) {
            name = text;
          }
        }

        // Fallback: if no child spans, parse combined text "Name Age"
        if (!name) {
          const full = (h1.textContent || "").trim();
          const m = full.match(/^(.+?)(\\d{2})$/);
          if (m) {
            name = m[1].trim();
            if (!age) age = m[2];
          }
        }
      }

      // Bio: first try to find text inside the "About me" section
      let bio = "";
      const main = document.querySelector("main") || document.body;

      // Strategy 1: locate the "About me" heading and grab the bio text near it
      const allElements = main.querySelectorAll("*");
      for (const el of allElements) {
        const ownText = (el.textContent || "").trim();
        if (ownText.toLowerCase() === "about me" || ownText === "About me") {
          // Walk siblings after the "About me" heading
          let sibling = el.nextElementSibling;
          while (sibling) {
            const t = (sibling.innerText || sibling.textContent || "").trim();
            if (t && t.length >= 2 && t.toLowerCase() !== "about me") {
              bio = t;
              break;
            }
            sibling = sibling.nextElementSibling;
          }
          // If no sibling found, try the parent's next sibling
          if (!bio && el.parentElement) {
            let parentSibling = el.parentElement.nextElementSibling;
            while (parentSibling) {
              const t = (parentSibling.innerText || parentSibling.textContent || "").trim();
              if (t && t.length >= 2 && t.toLowerCase() !== "about me") {
                bio = t;
                break;
              }
              parentSibling = parentSibling.nextElementSibling;
            }
          }
          if (bio) break;
        }
      }

      // Strategy 2: fallback - scan [dir="auto"], p, BreakWord elements
      if (!bio) {
        const uiLabels = [
          "skip to main", "safety toolkit", "work mode", "boost", "explore",
          "matches", "messages", "basics & lifestyle", "show more",
          "nope", "like", "super like", "open profile", "close profile",
          "photo verified", "recently active", "hide", "looking for",
          "about me", "essentials", "matched", "preferences",
          "short-term", "long-term", "new friends", "relationship"
        ];
        function isLabel(t) {
          const lower = t.toLowerCase();
          return uiLabels.some(m => lower === m);
        }
        const bioElems = main.querySelectorAll('[dir="auto"], p, div[class*="BreakWord"]');
        const bioCandidates = [];
        for (const el of bioElems) {
          const text = (el.innerText || "").trim();
          if (!text || text.length < 5 || text.length > 1000) continue;
          if (isLabel(text)) continue;
          if (text === name || text === age || text === name + " " + age) continue;
          if (/^(\\d+ (Photos?|km|likes)|Verified|Photo verified|Recently Active|My Anthem|Basics|Lifestyle)/i.test(text)) continue;
          const lineCount = text.split("\\n").length;
          if (lineCount > 10) continue;
          if (name && text.includes(name) && text.length < name.length + 10) continue;
          bioCandidates.push(text);
        }
        if (bioCandidates.length > 0) {
          bioCandidates.sort((a, b) => b.length - a.length);
          bio = bioCandidates[0];
        }
      }

      return { name, age, bio, raw: (name + " " + age + " " + bio).trim() };
    })()`) as { name: string; age: string; bio: string; raw: string };

    if (!result.name && !result.bio && !result.raw) {
      return null;
    }

    return result;
  }

  /**
   * Navigates through all profile photos using Space key and captures
   * a screenshot of the card area for each one.
   */
  private async captureAllPhotos(): Promise<string[]> {
    const photos: string[] = [];

    try {
      await this.ensureFocus();

      const cardElement = await this.findCardElement();

      if (!cardElement) {
        return photos;
      }

      const firstShot = await cardElement.screenshot({
        type: "jpeg",
        quality: 50,
      });

      photos.push(firstShot.toString("base64"));
      let prevSize = firstShot.length;

      for (let i = 1; i < MAX_PHOTOS; i++) {
        await this.page.keyboard.press("Space");
        await this.page.waitForTimeout(PHOTO_NAV_DELAY_MS);

        const shot = await cardElement.screenshot({
          type: "jpeg",
          quality: 50,
        });

        const sizeDiff = Math.abs(shot.length - prevSize);
        const changeRatio = sizeDiff / Math.max(prevSize, 1);

        if (changeRatio < 0.02) {
          break;
        }

        photos.push(shot.toString("base64"));
        prevSize = shot.length;
      }

    } catch {
      // Return whatever we captured
    }

    return photos;
  }

  private async findCardElement() {
    const cardSelectors = [
      SELECTORS.cardPhotoContainer,
      SELECTORS.cardPhotoContainerAlt,
      SELECTORS.cardPhotoContainerAlt2,
    ];

    for (const selector of cardSelectors) {
      try {
        const el = await this.page.$(selector);

        if (!el) {
          continue;
        }

        const isVisible = await el.isVisible();
        const box = await el.boundingBox();

        // Only use elements that are large enough to be the photo card
        if (isVisible && box && box.width > 200 && box.height > 200) {
          return el;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async simulateProfileBrowsing(): Promise<void> {
    if (Math.random() > 0.3) {
      return;
    }

    const scrollAmount = 200 + Math.floor(Math.random() * 300);

    await this.page.mouse.wheel(0, scrollAmount);
    await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 2000));

    if (Math.random() > 0.5) {
      const scrollBack = 100 + Math.floor(Math.random() * 200);

      await this.page.mouse.wheel(0, -scrollBack);
      await this.page.waitForTimeout(500 + Math.floor(Math.random() * 1000));
    }
  }

  async simulateIdleBehavior(durationMs: number): Promise<void> {
    let elapsed = 0;

    while (elapsed < durationMs) {
      const moveX = 400 + Math.floor(Math.random() * 480);
      const moveY = 200 + Math.floor(Math.random() * 400);

      await this.page.mouse.move(moveX, moveY, {
        steps: 3 + Math.floor(Math.random() * 5),
      });

      const interval = 5000 + Math.floor(Math.random() * 25000);
      const wait = Math.min(interval, durationMs - elapsed);

      await this.page.waitForTimeout(wait);
      elapsed += wait;
    }
  }

  private async findAnyVisible(selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);

        if (element) {
          const isVisible = await element.isVisible();

          if (isVisible) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  }
}
