import { describe, expect, it } from "vitest";
import {
  formatByteSize,
  mapOllamaDownloadPercent,
} from "../src/infrastructure/bootstrap/bootstrap-progress.js";

describe("mapOllamaDownloadPercent", () => {
  it("maps download percent into the ollama segment of overall bootstrap", () => {
    expect(mapOllamaDownloadPercent(0)).toBe(35);
    expect(mapOllamaDownloadPercent(100)).toBe(90);
    expect(mapOllamaDownloadPercent(50)).toBe(63);
  });

  it("clamps out-of-range values", () => {
    expect(mapOllamaDownloadPercent(-10)).toBe(35);
    expect(mapOllamaDownloadPercent(150)).toBe(90);
  });
});

describe("formatByteSize", () => {
  it("formats bytes, kilobytes, and megabytes", () => {
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(2048)).toBe("2.0 KB");
    expect(formatByteSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
