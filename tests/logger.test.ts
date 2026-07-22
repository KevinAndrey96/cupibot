import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logInfo,
  parseConsoleLine,
  setLogSink,
  type LogEntry,
} from "../src/infrastructure/logging/logger.js";

describe("parseConsoleLine", () => {
  it("extracts tag and message from bracketed console output", () => {
    expect(parseConsoleLine("info", ["[CupiBot] Mode: Swipe Tinder"])).toEqual({
      level: "info",
      tag: "CupiBot",
      message: "Mode: Swipe Tinder",
    });
  });

  it("falls back to CupiBot tag when prefix is missing", () => {
    expect(parseConsoleLine("error", ["connection refused"])).toEqual({
      level: "error",
      tag: "CupiBot",
      message: "connection refused",
    });
  });
});

describe("setLogSink", () => {
  afterEach(() => {
    setLogSink(null);
  });

  it("forwards console.log output to the active sink", () => {
    const entries: LogEntry[] = [];

    setLogSink((entry) => {
      entries.push(entry);
    }, false);

    console.log("[Bootstrap] runtime dependencies ready");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.tag).toBe("Bootstrap");
    expect(entries[0]?.message).toBe("runtime dependencies ready");
    expect(entries[0]?.level).toBe("info");
  });

  it("does not duplicate sink entries when logInfo is used", () => {
    const entries: LogEntry[] = [];

    setLogSink((entry) => {
      entries.push(entry);
    }, false);

    logInfo("CupiBot", "session started");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe("session started");
  });

  it("stops forwarding after clearing the sink", () => {
    const entries: LogEntry[] = [];

    setLogSink((entry) => {
      entries.push(entry);
    }, false);

    console.log("[CupiBot] first");
    setLogSink(null);
    console.log("[CupiBot] second");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe("first");
  });
});
