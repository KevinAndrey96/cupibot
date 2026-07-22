import fs from "node:fs";
import path from "node:path";
import type {
  ChatMessage,
  Conversation,
  ConversationStorePort,
} from "../../domain/types.js";
import { resolveDataPath } from "../../config/data-dir.js";

export const HISTORICAL_EXPORT_VERSION = 1;

export interface HistoricalConversationExport {
  name: string;
  platformId: string;
  messages: Array<{
    sender: "me" | "them";
    content: string;
    timestamp: string;
  }>;
}

export interface HistoricalExport {
  version: number;
  exportedAt: string;
  conversations: HistoricalConversationExport[];
}

export function parseHistoricalExport(raw: string): HistoricalConversationExport[] {
  if (!raw.trim()) {
    return [];
  }

  const parsed = JSON.parse(raw) as HistoricalExport | HistoricalConversationExport[];

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed.version === HISTORICAL_EXPORT_VERSION && Array.isArray(parsed.conversations)) {
    return parsed.conversations;
  }

  return [];
}

export function mergeHistoricalExports(
  existing: HistoricalConversationExport[],
  fresh: HistoricalConversationExport[],
): HistoricalConversationExport[] {
  const byKey = new Map<string, HistoricalConversationExport>();

  for (const conv of existing) {
    byKey.set(conv.platformId || conv.name, conv);
  }

  for (const conv of fresh) {
    byKey.set(conv.platformId || conv.name, conv);
  }

  return [...byKey.values()];
}

const MESSAGES_DIR = "messages";


interface MessageLine {
  sender: "me" | "them";
  timestamp: string;
  content: string;
}

export class ConversationStore implements ConversationStorePort {
  private readonly dir: string;

  constructor(messagesDir?: string) {
    this.dir = messagesDir ?? resolveDataPath(MESSAGES_DIR);

    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  load(platformId: string, name: string): Conversation {
    this.migrateIfNeeded(platformId, name);

    const filePath = this.filePath(platformId, name);

    if (!fs.existsSync(filePath)) {
      return { name, platformId, messages: [] };
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim());
    const messages: ChatMessage[] = [];

    for (const line of lines) {
      const parsed = this.parseLine(line);

      if (parsed) {
        messages.push(parsed);
      }
    }

    return { name, platformId, messages };
  }

  save(conversation: Conversation): void {
    const filePath = this.filePath(conversation.platformId, conversation.name);
    const lines = conversation.messages.map((msg) => this.toJsonLine(msg));

    fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
  }

  merge(
    platformId: string,
    name: string,
    freshMessages: ChatMessage[],
  ): Conversation {
    const existing = this.load(platformId, name);

    if (existing.messages.length === 0) {
      const conv = { name, platformId, messages: freshMessages };
      this.save(conv);

      return conv;
    }

    if (freshMessages.length === 0) {
      return existing;
    }

    const lastExisting = existing.messages[existing.messages.length - 1];
    let overlapIndex = -1;

    for (let i = freshMessages.length - 1; i >= 0; i--) {
      if (
        freshMessages[i].sender === lastExisting.sender &&
        freshMessages[i].content.trim() === lastExisting.content.trim()
      ) {
        overlapIndex = i;
        break;
      }
    }

    let merged: ChatMessage[];

    if (overlapIndex >= 0) {
      merged = [
        ...existing.messages,
        ...freshMessages.slice(overlapIndex + 1),
      ];
    } else {
      const existingKeys = new Set(
        existing.messages.map((m) => `${m.sender}:${m.content.trim()}`),
      );
      const newOnes = freshMessages.filter(
        (m) => !existingKeys.has(`${m.sender}:${m.content.trim()}`),
      );

      merged = [...existing.messages, ...newOnes];
    }

    const conv = { name, platformId, messages: merged };
    this.save(conv);

    return conv;
  }

  listAll(): Array<{ name: string; platformId: string }> {
    if (!fs.existsSync(this.dir)) {
      return [];
    }

    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const base = f.replace(/\.jsonl$/, "");
        const lastUnderscore = base.lastIndexOf("_");

        if (lastUnderscore > 0 && base.length - lastUnderscore - 1 >= 4) {
          return {
            name: base.substring(0, lastUnderscore),
            platformId: base.substring(lastUnderscore + 1),
          };
        }

        return { name: base, platformId: "" };
      });
  }

  exportHistorical(): void {
    const entries = this.listAll();
    const fresh = entries.map((entry) => {
      const conversation = this.load(entry.platformId, entry.name);

      return {
        name: conversation.name,
        platformId: conversation.platformId,
        messages: conversation.messages.map((m) => ({
          sender: m.sender,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
      };
    });

    const outPath = resolveDataPath("context", "historical.json");
    const outDir = path.dirname(outPath);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const existing = fs.existsSync(outPath)
      ? parseHistoricalExport(fs.readFileSync(outPath, "utf-8"))
      : [];
    const merged = mergeHistoricalExports(existing, fresh);
    const payload: HistoricalExport = {
      version: HISTORICAL_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      conversations: merged,
    };
    const tmpPath = `${outPath}.tmp`;

    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
    fs.renameSync(tmpPath, outPath);
    console.log(`[Store] exported ${merged.length} conversations to ${outPath}`);
  }

  private migrateIfNeeded(platformId: string, name: string): void {
    if (!platformId) {
      return;
    }

    const newPath = this.filePath(platformId, name);

    if (fs.existsSync(newPath)) {
      return;
    }

    const oldPath = this.legacyFilePath(name);

    if (!fs.existsSync(oldPath)) {
      return;
    }

    fs.renameSync(oldPath, newPath);
    console.log(`[Store] Migrated ${path.basename(oldPath)} -> ${path.basename(newPath)}`);
  }

  private filePath(platformId: string, name: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9À-ÿ _-]/g, "").trim();

    if (!platformId) {
      return path.join(this.dir, `${safeName}.jsonl`);
    }

    const safeId = platformId.replace(/[^a-zA-Z0-9]/g, "");

    return path.join(this.dir, `${safeName}_${safeId}.jsonl`);
  }

  private legacyFilePath(name: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9À-ÿ _-]/g, "").trim();

    return path.join(this.dir, `${safeName}.jsonl`);
  }

  private toJsonLine(msg: ChatMessage): string {
    const line: MessageLine = {
      sender: msg.sender,
      timestamp: msg.timestamp.toISOString(),
      content: msg.content,
    };

    return JSON.stringify(line);
  }

  private parseLine(line: string): ChatMessage | null {
    try {
      const data = JSON.parse(line) as MessageLine;

      if (data.sender !== "me" && data.sender !== "them") {
        return null;
      }

      return {
        sender: data.sender,
        timestamp: new Date(data.timestamp),
        content: data.content,
      };
    } catch {
      return null;
    }
  }
}
