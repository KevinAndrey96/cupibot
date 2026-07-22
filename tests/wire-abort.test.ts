import { describe, expect, it, vi } from "vitest";
import { wireAbortSignal } from "../src/composition/wire-abort.js";

describe("wireAbortSignal", () => {
  it("runs handlers when the signal is already aborted", () => {
    const controller = new AbortController();
    const handler = vi.fn();

    controller.abort();
    wireAbortSignal(controller.signal, [handler]);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs handlers when the signal aborts later", () => {
    const controller = new AbortController();
    const handler = vi.fn();

    wireAbortSignal(controller.signal, [handler]);
    controller.abort();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs every registered handler once", () => {
    const controller = new AbortController();
    const first = vi.fn();
    const second = vi.fn();

    wireAbortSignal(controller.signal, [first, second]);
    controller.abort();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
