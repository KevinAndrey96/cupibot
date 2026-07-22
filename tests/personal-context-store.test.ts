import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { PersonalContextStore } from "../src/infrastructure/storage/personal-context-store.js";
import { createTempDir, removeTempDir } from "./helpers/temp-dir.js";

const seedContext = [
  { question: "De dónde eres?", answer: "De Colombia", askedBy: "seed", askedAt: "" },
  { question: "Qué haces?", answer: "Trabajo en tech", askedBy: "seed", askedAt: "" },
];

describe("PersonalContextStore", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      removeTempDir(tempDir);
    }
  });

  it("merges seed context with answered runtime entries", () => {
    tempDir = createTempDir("ctx-store-");
    const store = new PersonalContextStore(seedContext, tempDir);

    store.logUnknownQuestion("Cuál es tu comida favorita?", "Maria");

    const known = store.loadKnownContext();

    expect(known).toHaveLength(2);
    expect(known.map((e) => e.question)).toContain("De dónde eres?");
    expect(known.map((e) => e.question)).toContain("Qué haces?");
  });

  it("deduplicates unknown questions case-insensitively", () => {
    tempDir = createTempDir("ctx-store-");
    const store = new PersonalContextStore([], tempDir);

    store.logUnknownQuestion("Cuál es tu hobby?", "Ana");
    store.logUnknownQuestion("cuál es tu hobby?", "Ana");

    const known = store.loadKnownContext();

    expect(known).toHaveLength(0);
  });

  it("does not log questions already in seed context", () => {
    tempDir = createTempDir("ctx-store-");
    const store = new PersonalContextStore(seedContext, tempDir);

    store.logUnknownQuestion("de dónde eres?", "Maria");

    const known = store.loadKnownContext();

    expect(known).toHaveLength(2);
  });

  it("includes runtime entries once answered", () => {
    tempDir = createTempDir("ctx-store-");
    const store = new PersonalContextStore(seedContext, tempDir);

    store.logUnknownQuestion("Tienes mascotas?", "Lu");

    const runtimePath = `${tempDir}/runtime-context.json`;
    const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf-8")) as Array<{
      question: string;
      answer: string;
    }>;

    runtime[0].answer = "Tengo un perro";
    fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2), "utf-8");

    const known = store.loadKnownContext();

    expect(known.some((e) => e.question === "Tienes mascotas?")).toBe(true);
  });
});
