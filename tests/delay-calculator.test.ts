import { describe, expect, it, vi } from "vitest";
import { DelayCalculator } from "../src/domain/delay-calculator.js";

describe("DelayCalculator", () => {
  const fastCalculator = new DelayCalculator(0, 0, 0, 0, 9999, 9999, 0, 0, 0);
  const rangedCalculator = new DelayCalculator(1000, 2000, 5000, 8000, 8, 12, 5000, 180_000, 300_000);

  it("returns swipe delay within configured range", () => {
    for (let i = 0; i < 30; i++) {
      const delay = rangedCalculator.swipeDelay();

      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(2000);
    }
  });

  it("returns zero swipe delay when configured to zero", () => {
    for (let i = 0; i < 10; i++) {
      expect(fastCalculator.swipeDelay()).toBe(0);
    }
  });

  it("returns batch pause within configured range", () => {
    for (let i = 0; i < 30; i++) {
      const pause = rangedCalculator.batchPause();

      expect(pause).toBeGreaterThanOrEqual(5000);
      expect(pause).toBeLessThanOrEqual(8000);
    }
  });

  it("returns batch size within configured range", () => {
    for (let i = 0; i < 30; i++) {
      const size = rangedCalculator.nextBatchSize();

      expect(size).toBeGreaterThanOrEqual(8);
      expect(size).toBeLessThanOrEqual(12);
    }
  });

  it("returns viewing delay within configured range", () => {
    for (let i = 0; i < 30; i++) {
      const delay = rangedCalculator.viewingDelay();

      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });

  it("returns zero viewing delay when disabled", () => {
    for (let i = 0; i < 10; i++) {
      expect(fastCalculator.viewingDelay()).toBe(0);
    }
  });

  it("returns rest break within configured range", () => {
    for (let i = 0; i < 30; i++) {
      const duration = rangedCalculator.restBreakDuration();

      expect(duration).toBeGreaterThanOrEqual(180_000);
      expect(duration).toBeLessThanOrEqual(300_000);
    }
  });

  it("returns zero rest break when disabled", () => {
    for (let i = 0; i < 10; i++) {
      expect(fastCalculator.restBreakDuration()).toBe(0);
    }
  });

  it("uses inclusive random bounds", () => {
    const calculator = new DelayCalculator(5, 5, 5, 5, 5, 5, 5, 5, 5);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.999);

    expect(calculator.swipeDelay()).toBe(5);
    expect(calculator.nextBatchSize()).toBe(5);

    randomSpy.mockRestore();
  });
});
