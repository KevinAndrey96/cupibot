import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAllowedRelativePath,
  assertPathInsideRoot,
  assertSafeFileName,
} from "../desktop/shared/path-safety.js";

describe("assertSafeFileName", () => {
  it("accepts a plain file name", () => {
    expect(assertSafeFileName("Ana_123.jsonl")).toBe("Ana_123.jsonl");
  });

  it("rejects path traversal", () => {
    expect(() => assertSafeFileName("../.env")).toThrow(/invalid file name/i);
    expect(() => assertSafeFileName("nested/file.jsonl")).toThrow(/invalid file name/i);
  });
});

describe("assertAllowedRelativePath", () => {
  const allowed = ["config/ai/espanol/chat.json"];

  it("accepts allowlisted paths", () => {
    expect(assertAllowedRelativePath(allowed, "config/ai/espanol/chat.json"))
      .toBe("config/ai/espanol/chat.json");
  });

  it("rejects paths outside the allowlist", () => {
    expect(() => assertAllowedRelativePath(allowed, "../../../.env"))
      .toThrow(/path not allowed/i);
  });
});

describe("assertPathInsideRoot", () => {
  const root = path.resolve("/tmp/cupibot-data/messages");

  it("accepts files inside the root directory", () => {
    const target = path.join(root, "Ana.jsonl");

    expect(assertPathInsideRoot(root, target)).toBe(target);
  });

  it("rejects paths that escape the root directory", () => {
    const target = path.resolve("/tmp/cupibot-data/.env");

    expect(() => assertPathInsideRoot(root, target)).toThrow(/escapes allowed directory/i);
  });
});
