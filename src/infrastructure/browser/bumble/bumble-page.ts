import type { Page } from "playwright";
import type { SwipePagePort, ProfileInfo } from "../../../domain/types.js";
import { SELECTORS } from "./selectors.js";

const BUMBLE_URL = "https://bumble.com/app";
const NAV_TIMEOUT_MS = 30_000;
const SHORT_TIMEOUT_MS = 2_000;
const PHOTO_NAV_DELAY_MS = 600;
const MAX_PHOTOS = 6;

export class BumblePage implements SwipePagePort {
  constructor(private readonly page: Page) {}

  async navigate(): Promise<void> {
    await this.page.goto(BUMBLE_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
  }

  async isOnSwipeScreen(): Promise<boolean> {
    try {
      const url = this.page.url();

      if (!url.includes("bumble.com")) {
        return false;
      }

      const hasCards = await this.findAnyVisible([
        SELECTORS.encountersStory,
        SELECTORS.encountersCard,
        SELECTORS.likeButton,
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
      SELECTORS.matchDialog,
    ]);
  }

  async sendMatchMessage(_message: string): Promise<boolean> {
    // Bumble requires the woman to message first (hetero mode).
    // We never send an opener on match - just dismiss.
    return false;
  }

  async hasPopup(): Promise<boolean> {
    const popupIndicators = [
      SELECTORS.matchDialog,
      SELECTORS.matchText,
      SELECTORS.noThanksButton,
      SELECTORS.maybeLaterButton,
      SELECTORS.notNowButton,
      SELECTORS.gotItButton,
      SELECTORS.continueButton,
      SELECTORS.matchKeepSwiping,
    ];

    return this.findAnyVisible(popupIndicators);
  }

  async dismissPopup(): Promise<void> {
    const dismissSelectors = [
      SELECTORS.matchKeepSwiping,
      SELECTORS.noThanksButton,
      SELECTORS.maybeLaterButton,
      SELECTORS.notNowButton,
      SELECTORS.gotItButton,
      SELECTORS.continueButton,
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
        SELECTORS.outOfVotesText,
        SELECTORS.outOfLikesText,
        SELECTORS.getMoreButton,
      ]);
    } catch {
      return false;
    }
  }

  async extractProfileInfo(): Promise<ProfileInfo | null> {
    try {
      const photos = await this.captureAllPhotos();

      const textInfo = await this.extractProfileText();

      if (!textInfo) {
        return { name: "", age: "", bio: "", raw: "", photos };
      }

      return { ...textInfo, photos };
    } catch {
      return null;
    }
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

  private async ensureFocus(): Promise<void> {
    try {
      await this.page.mouse.click(640, 400);
      await this.page.waitForTimeout(200);
    } catch {
      // ignore
    }
  }

  /**
   * Extracts name, age, and bio from the Bumble encounter card.
   * Bumble uses dedicated class names for profile fields.
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
      let bio = "";

      const nameEl = document.querySelector(".encounters-story-profile__name");
      if (nameEl) {
        name = (nameEl.textContent || "").trim();
      }

      const ageEl = document.querySelector(".encounters-story-profile__age");
      if (ageEl) {
        age = (ageEl.textContent || "").replace(/,/g, "").trim();
      }

      const aboutEls = document.querySelectorAll(".encounters-story-about__text");
      const bioLines = [];
      for (const el of aboutEls) {
        const text = (el.textContent || "").trim();
        if (text) {
          bioLines.push(text);
        }
      }
      bio = bioLines.join(" ");

      if (!name && !bio) {
        return null;
      }

      return { name, age, bio, raw: (name + " " + age + " " + bio).trim() };
    })()`) as { name: string; age: string; bio: string; raw: string } | null;

    return result;
  }

  /**
   * Captures screenshots of each profile photo by navigating through them.
   * Bumble uses arrow keys to cycle photos in the encounter card.
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
      SELECTORS.photoContainer,
      SELECTORS.encountersCard,
      SELECTORS.encountersStory,
    ];

    for (const selector of cardSelectors) {
      try {
        const el = await this.page.$(selector);

        if (!el) {
          continue;
        }

        const isVisible = await el.isVisible();
        const box = await el.boundingBox();

        if (isVisible && box && box.width > 200 && box.height > 200) {
          return el;
        }
      } catch {
        continue;
      }
    }

    return null;
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
