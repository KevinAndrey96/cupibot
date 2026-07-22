import type { DelayCalculatorPort } from "./types.js";

export class DelayCalculator implements DelayCalculatorPort {
  constructor(
    private readonly minDelayMs: number,
    private readonly maxDelayMs: number,
    private readonly batchPauseMinMs: number,
    private readonly batchPauseMaxMs: number,
    private readonly batchSizeMin: number,
    private readonly batchSizeMax: number,
    private readonly viewingDelayMaxMs: number,
    private readonly restBreakMinMs: number,
    private readonly restBreakMaxMs: number,
  ) {}

  swipeDelay(): number {
    return this.randomBetween(this.minDelayMs, this.maxDelayMs);
  }

  batchPause(): number {
    return this.randomBetween(this.batchPauseMinMs, this.batchPauseMaxMs);
  }

  nextBatchSize(): number {
    return Math.floor(
      this.randomBetween(this.batchSizeMin, this.batchSizeMax),
    );
  }

  viewingDelay(): number {
    return this.randomBetween(0, this.viewingDelayMaxMs);
  }

  restBreakDuration(): number {
    return this.randomBetween(this.restBreakMinMs, this.restBreakMaxMs);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
