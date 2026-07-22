import fs from "node:fs";
import path from "node:path";
import type {
  PersonalContextEntry,
  PersonalContextStorePort,
} from "../../domain/types.js";
import { resolveDataPath } from "../../config/data-dir.js";

const CONTEXT_DIR = "context";
const RUNTIME_FILE = "runtime-context.json";

export class PersonalContextStore implements PersonalContextStorePort {
  private readonly filePath: string;
  private readonly seedContext: PersonalContextEntry[];

  constructor(
    seedContext: PersonalContextEntry[],
    contextDir?: string,
  ) {
    const dir = contextDir ?? resolveDataPath(CONTEXT_DIR);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.filePath = path.join(dir, RUNTIME_FILE);
    this.seedContext = seedContext;

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), "utf-8");
    }
  }

  loadKnownContext(): PersonalContextEntry[] {
    const runtime = this.loadRuntime();

    return [
      ...this.seedContext,
      ...runtime.filter((e) => e.answer.trim() !== ""),
    ];
  }

  logUnknownQuestion(question: string, askedBy: string): void {
    const all = this.loadRuntime();
    const normalized = question.toLowerCase().trim();
    const existsInSeed = this.seedContext.some(
      (e) => e.question.toLowerCase().trim() === normalized,
    );
    const existsInRuntime = all.some(
      (e) => e.question.toLowerCase().trim() === normalized,
    );

    if (existsInSeed || existsInRuntime) {
      return;
    }

    const entry: PersonalContextEntry = {
      question,
      answer: "",
      askedBy,
      askedAt: new Date().toISOString(),
    };

    all.push(entry);
    this.saveRuntime(all);

    console.log(
      `[Context] unknown question logged: "${question}" (asked by ${askedBy})`,
    );
  }

  private loadRuntime(): PersonalContextEntry[] {
    const raw = fs.readFileSync(this.filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item: Record<string, string>) => ({
      question: String(item.question ?? ""),
      answer: String(item.answer ?? ""),
      askedBy: String(item.askedBy ?? ""),
      askedAt: String(item.askedAt ?? ""),
    }));
  }

  private saveRuntime(entries: PersonalContextEntry[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
  }
}
