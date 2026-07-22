import { describe, expect, it } from "vitest";
import { getManagedOllamaBinaryPath } from "../src/infrastructure/bootstrap/ollama-paths.js";

describe("getManagedOllamaBinaryPath", () => {
  it("returns a platform-specific managed binary path", () => {
    const binaryPath = getManagedOllamaBinaryPath();

    expect(binaryPath).toContain("ollama");
  });
});
