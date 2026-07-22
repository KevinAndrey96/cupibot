import { describe, expect, it, vi } from "vitest";
import { StatsTracker } from "../src/application/stats-tracker.js";

describe("StatsTracker", () => {
  it("tracks swipe and filter counters", () => {
    const tracker = new StatsTracker();

    tracker.recordLike();
    tracker.recordPass();
    tracker.recordMatch();
    tracker.recordMessageSent();
    tracker.recordFiltered("gender");
    tracker.recordFiltered("score");
    tracker.recordError();

    const summary = tracker.summary();

    expect(summary.likes).toBe(1);
    expect(summary.passes).toBe(1);
    expect(summary.matches).toBe(1);
    expect(summary.messagesSent).toBe(1);
    expect(summary.filtered).toBe(2);
    expect(summary.errors).toBe(1);
  });

  it("returns a copy from summary", () => {
    const tracker = new StatsTracker();
    tracker.recordLike();

    const first = tracker.summary();
    first.likes = 99;

    expect(tracker.summary().likes).toBe(1);
  });

  it("sets endedAt on finish", () => {
    const tracker = new StatsTracker();

    tracker.finish();

    expect(tracker.summary().endedAt).toBeInstanceOf(Date);
  });

  it("prints progress without throwing", () => {
    const tracker = new StatsTracker();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    tracker.recordLike();
    tracker.recordFiltered("name");
    tracker.printProgress(3, 10);

    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain("[Progress]");

    logSpy.mockRestore();
  });

  it("prints summary without throwing", () => {
    const tracker = new StatsTracker();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    tracker.recordPass();
    tracker.printSummary();

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("SESSION SUMMARY"))).toBe(
      true,
    );

    logSpy.mockRestore();
  });
});
