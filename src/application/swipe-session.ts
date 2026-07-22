import {
  SwipeDirection,
  type ChatBreakPort,
  type DelayCalculatorPort,
  type MatchHandlerPort,
  type ProfileClassifierPort,
  type ProfileInfo,
  type SessionConfig,
  type StatsTrackerPort,
  type SwipePagePort,
} from "../domain/types.js";

export type SwipeExitReason = "completed" | "aborted" | "out_of_likes";

export interface SwipeRunResult {
  reason: SwipeExitReason;
}

export class SwipeSession {
  private aborted = false;
  private lastRightProfile: ProfileInfo | null = null;

  constructor(
    private readonly swipePage: SwipePagePort,
    private readonly delayCalculator: DelayCalculatorPort,
    private readonly matchHandler: MatchHandlerPort,
    private readonly statsTracker: StatsTrackerPort,
    private readonly config: SessionConfig,
    private readonly classifier: ProfileClassifierPort,
    private readonly chatBreak: ChatBreakPort | null,
    private readonly onChatBreakStart: (() => Promise<void>) | null = null,
    private readonly onChatBreakEnd: (() => Promise<void>) | null = null,
  ) {}

  abort(): void {
    this.aborted = true;
  }

  private async pause(ms: number): Promise<void> {
    const stepMs = 250;
    let elapsed = 0;

    while (elapsed < ms && !this.aborted) {
      const waitMs = Math.min(stepMs, ms - elapsed);

      await sleep(waitMs);
      elapsed += waitMs;
    }
  }

  async run(): Promise<SwipeRunResult> {
    let totalSwipes = 0;
    let batchSwipes = 0;
    let batchSize = this.delayCalculator.nextBatchSize();
    let exitReason: SwipeExitReason = "completed";

    const restBreakPoints = this.generateRestBreakPoints();

    console.log(
      `[Session] starting swipe session (max: ${this.config.maxSwipes} swipes)`,
    );

    if (this.chatBreak) {
      console.log(
        `[Session] chat breaks every ${this.config.chatBreakInterval} swipes`,
      );
    }

    console.log(
      `[Session] rest breaks at swipes: ${[...restBreakPoints].sort((a, b) => a - b).join(", ")}`,
    );

    while (totalSwipes < this.config.maxSwipes && !this.aborted) {
      const shouldStop = await this.matchHandler.handlePopups(this.lastRightProfile);

      if (shouldStop) {
        console.log("[Session] session stopped: out of likes");
        exitReason = "out_of_likes";
        break;
      }

      const { direction, profile } = await this.resolveDirection();

      const viewDelay = this.delayCalculator.viewingDelay();

      if (viewDelay > 0) {
        await this.pause(viewDelay);
      }

      try {
        await this.performSwipe(direction);

        if (direction === SwipeDirection.RIGHT && profile) {
          this.lastRightProfile = profile;
        }

        totalSwipes++;
        batchSwipes++;

        if (totalSwipes % 10 === 0) {
          this.statsTracker.printProgress(totalSwipes, this.config.maxSwipes);
        }
      } catch (error) {
        this.statsTracker.recordError();
        console.error(
          `[Session] swipe failed: ${error instanceof Error ? error.message : error}`,
        );
      }

      console.log("");

      if (
        this.chatBreak
        && totalSwipes % this.config.chatBreakInterval === 0
        && totalSwipes < this.config.maxSwipes
      ) {
        await this.doChatBreak(totalSwipes);
        batchSwipes = 0;
        batchSize = this.delayCalculator.nextBatchSize();

        continue;
      }

      if (
        this.config.restBreakMaxMs > 0
        && restBreakPoints.has(totalSwipes)
      ) {
        const restMs = this.delayCalculator.restBreakDuration();

        console.log(
          `[Session] rest break at swipe ${totalSwipes}, resting for ${(restMs / 60_000).toFixed(1)} min...`,
        );

        await this.swipePage.simulateIdleBehavior(restMs);
        batchSwipes = 0;
        batchSize = this.delayCalculator.nextBatchSize();

        continue;
      }

      const cooldown = this.config.swipeCooldownMs;
      const jitter = this.delayCalculator.swipeDelay();
      const baseDelay = Math.max(cooldown, jitter);

      if (batchSwipes >= batchSize && totalSwipes < this.config.maxSwipes) {
        const pause = this.delayCalculator.batchPause();

        console.log(
          `[Session] batch of ${batchSwipes} complete, pausing for ${(pause / 1000).toFixed(1)}s...`,
        );

        await this.pause(pause);

        batchSwipes = 0;
        batchSize = this.delayCalculator.nextBatchSize();
      } else {
        await this.pause(baseDelay);
      }
    }

    if (this.aborted) {
      exitReason = "aborted";
    }

    console.log(`[Session] session finished, total swipes: ${totalSwipes}`);

    return { reason: exitReason };
  }

  private generateRestBreakPoints(): Set<number> {
    const points = new Set<number>();
    const max = this.config.maxSwipes;
    const bucketSize = Math.max(1, Math.floor(max / 10));

    for (let i = 0; i < 10; i++) {
      const bucketStart = i * bucketSize + 1;
      const bucketEnd = Math.min((i + 1) * bucketSize, max);
      const point = bucketStart + Math.floor(Math.random() * (bucketEnd - bucketStart + 1));

      points.add(point);
    }

    return points;
  }

  private async doChatBreak(swipeNumber: number): Promise<void> {
    console.log(
      `[Session] chat break at swipe ${swipeNumber}, switching to messages...`,
    );

    if (this.onChatBreakStart) {
      await this.onChatBreakStart();
    }

    if (this.chatBreak) {
      await this.chatBreak.runCycle();
    }

    if (this.onChatBreakEnd) {
      await this.onChatBreakEnd();
    }

    console.log("[Session] chat break complete, resuming swipes...");
    await this.swipePage.navigate();

    if (this.config.chatBreakResumeMs > 0) {
      await this.pause(this.config.chatBreakResumeMs);
    }
  }

  private async resolveDirection(): Promise<{
    direction: SwipeDirection;
    profile: ProfileInfo | null;
  }> {
    const profile = await this.swipePage.extractProfileInfo();

    if (!profile) {
      const direction = this.config.onExtractFailure === "like"
        ? SwipeDirection.RIGHT
        : SwipeDirection.LEFT;

      return { direction, profile: null };
    }

    const result = await this.classifier.classify(profile);

    if (!result.approved) {
      this.statsTracker.recordFiltered(result.rejectedBy!);

      return { direction: SwipeDirection.LEFT, profile };
    }

    return { direction: SwipeDirection.RIGHT, profile };
  }

  private async performSwipe(direction: SwipeDirection): Promise<void> {
    if (direction === SwipeDirection.RIGHT) {
      await this.swipePage.clickLike();
      this.statsTracker.recordLike();
      console.log("[Swipe] RIGHT (like)");
    } else {
      await this.swipePage.clickPass();
      this.statsTracker.recordPass();
      console.log("[Swipe] LEFT (pass)");
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
