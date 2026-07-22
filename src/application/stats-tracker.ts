import type { FilterBreakdown, FilterStage, SessionStats, StatsTrackerPort } from "../domain/types.js";

export interface SessionStatsWithBreakdown extends SessionStats {
  filterBreakdown: FilterBreakdown;
}

export interface SwipeProgress {
  current: number;
  max: number;
  stats: SessionStats;
  filterBreakdown: FilterBreakdown;
}

export class StatsTracker implements StatsTrackerPort {
  private stats: SessionStats = {
    likes: 0,
    passes: 0,
    matches: 0,
    messagesSent: 0,
    filtered: 0,
    errors: 0,
    startedAt: new Date(),
    endedAt: null,
  };

  private filterBreakdown: FilterBreakdown = {
    name: 0,
    gender: 0,
    body: 0,
    score: 0,
    text: 0,
  };

  private onProgressCallback: ((progress: SwipeProgress) => void) | null = null;

  setProgressCallback(callback: ((progress: SwipeProgress) => void) | null): void {
    this.onProgressCallback = callback;
  }

  recordLike(): void {
    this.stats.likes++;
  }

  recordPass(): void {
    this.stats.passes++;
  }

  recordMatch(): void {
    this.stats.matches++;
  }

  recordMessageSent(): void {
    this.stats.messagesSent++;
  }

  recordFiltered(stage: FilterStage): void {
    this.stats.filtered++;
    this.filterBreakdown[stage]++;
  }

  recordError(): void {
    this.stats.errors++;
  }

  finish(): void {
    this.stats.endedAt = new Date();
  }

  summary(): SessionStats {
    return { ...this.stats };
  }

  filterBreakdownSummary(): FilterBreakdown {
    return { ...this.filterBreakdown };
  }

  fullSummary(): SessionStatsWithBreakdown {
    return {
      ...this.summary(),
      filterBreakdown: this.filterBreakdownSummary(),
    };
  }

  printProgress(current: number, max: number): void {
    const total = this.stats.likes + this.stats.passes;
    const filterRate = total > 0 ? Math.round((this.stats.filtered / total) * 100) : 0;
    const elapsed = Math.round((Date.now() - this.stats.startedAt.getTime()) / 1000);
    const fb = this.filterBreakdown;

    console.log(
      `[Progress] ${current}/${max} | ` +
        `likes: ${this.stats.likes} | ` +
        `filtered: ${this.stats.filtered} (${filterRate}%) ` +
        `[name:${fb.name} gender:${fb.gender} body:${fb.body} score:${fb.score} text:${fb.text}] | ` +
        `matches: ${this.stats.matches} | ` +
        `elapsed: ${elapsed}s`,
    );

    if (this.onProgressCallback) {
      this.onProgressCallback({
        current,
        max,
        stats: this.summary(),
        filterBreakdown: this.filterBreakdownSummary(),
      });
    }
  }

  printSummary(): void {
    this.finish();

    const duration = this.stats.endedAt
      ? Math.round(
          (this.stats.endedAt.getTime() - this.stats.startedAt.getTime()) /
            1000,
        )
      : 0;

    const totalSwipes = this.stats.likes + this.stats.passes;

    console.log("\n========================================");
    console.log("         SESSION SUMMARY");
    console.log("========================================");
    console.log(`  Total swipes:  ${totalSwipes}`);
    console.log(`  Likes (right): ${this.stats.likes}`);
    console.log(`  Passes (left): ${this.stats.passes}`);
    console.log(`  Matches:       ${this.stats.matches}`);
    console.log(`  Messages sent: ${this.stats.messagesSent}`);
    console.log(`  AI filtered:   ${this.stats.filtered}`);
    console.log(`    ├─ Name:     ${this.filterBreakdown.name}`);
    console.log(`    ├─ Gender:   ${this.filterBreakdown.gender}`);
    console.log(`    ├─ Body:     ${this.filterBreakdown.body}`);
    console.log(`    ├─ Score:    ${this.filterBreakdown.score}`);
    console.log(`    └─ Text:     ${this.filterBreakdown.text}`);
    console.log(`  Errors:        ${this.stats.errors}`);
    console.log(`  Duration:      ${duration}s`);
    console.log("========================================\n");
  }
}
