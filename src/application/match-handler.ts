import type {
  MatchHandlerPort,
  SwipePagePort,
  StatsTrackerPort,
  ProfileClassifierPort,
  ProfileInfo,
} from "../domain/types.js";
import { pickRandomOpener } from "../config/ai-config.js";
import type { OpenersConfig } from "../config/ai-config.js";

const MAX_DISMISS_ATTEMPTS = 3;
const DISMISS_SETTLE_MS = 800;

export class MatchHandler implements MatchHandlerPort {
  constructor(
    private readonly swipePage: SwipePagePort,
    private readonly statsTracker: StatsTrackerPort,
    private readonly classifier: ProfileClassifierPort | null,
    private readonly openers: OpenersConfig,
    private readonly sendOpenerOnMatch: boolean,
  ) {}

  async handlePopups(lastProfile: ProfileInfo | null): Promise<boolean> {
    const outOfLikes = await this.swipePage.hasOutOfLikes();

    if (outOfLikes) {
      console.log("[MatchHandler] out of likes detected, stopping session");

      return true;
    }

    const isMatch = await this.swipePage.hasMatchPopup();

    if (isMatch) {
      this.statsTracker.recordMatch();

      if (this.sendOpenerOnMatch) {
        console.log("[MatchHandler] match detected, sending opener...");
        await this.sendOpener(lastProfile);
      } else {
        console.log("[MatchHandler] match detected (opener disabled for this platform)");
      }

      await this.swipePage.dismissPopup();
      await sleep(DISMISS_SETTLE_MS);

      return false;
    }

    let attempts = 0;

    while (attempts < MAX_DISMISS_ATTEMPTS) {
      const hasPopup = await this.swipePage.hasPopup();

      if (!hasPopup) {
        break;
      }

      console.log("[MatchHandler] popup detected, dismissing...");

      await this.swipePage.dismissPopup();
      await sleep(DISMISS_SETTLE_MS);

      attempts++;
    }

    return false;
  }

  private async sendOpener(profile: ProfileInfo | null): Promise<void> {
    let message = pickRandomOpener(this.openers.messages);

    if (this.classifier && profile) {
      message = await this.classifier.personalizeOpener(profile, message);
    }

    const sent = await this.swipePage.sendMatchMessage(message);

    if (sent) {
      this.statsTracker.recordMessageSent();
      console.log(`[MatchHandler] message sent: "${message.substring(0, 80)}..."`);
    } else {
      console.log("[MatchHandler] could not send message, closing match popup");
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
