import fs from "node:fs";
import path from "node:path";
import { ConversationStore, parseHistoricalExport } from "../../../src/infrastructure/storage/conversation-store.js";
import { InstagramStore } from "../../../src/infrastructure/storage/instagram-store.js";
import { UnmatchStore } from "../../../src/infrastructure/storage/unmatch-store.js";
import type { ConversationListItem, AnalysisReportData } from "../../shared/ipc.js";
import {
  assertPathInsideRoot,
  assertSafeFileName,
} from "../../shared/path-safety.js";
import { resolveDataFile } from "../data-path.js";

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export class DataService {
  listConversations(): ConversationListItem[] {
    const messagesDir = resolveDataFile("messages");

    if (!fs.existsSync(messagesDir)) {
      return [];
    }

    const store = new ConversationStore(messagesDir);

    return store.listAll().map((entry) => {
      const conversation = store.load(entry.platformId, entry.name);
      const fileName = entry.platformId
        ? `${entry.name}_${entry.platformId}.jsonl`
        : `${entry.name}.jsonl`;

      return {
        fileName,
        name: entry.name,
        platformId: entry.platformId,
        messageCount: conversation.messages.length,
      };
    });
  }

  readConversation(fileName: string): unknown[] {
    const safeName = assertSafeFileName(fileName);
    const messagesDir = resolveDataFile("messages");
    const filePath = assertPathInsideRoot(messagesDir, path.join(messagesDir, safeName));

    if (!fs.existsSync(filePath)) {
      throw new Error(`conversation not found: ${fileName}`);
    }

    return fs.readFileSync(filePath, "utf-8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }

  readHistorical(): unknown {
    const filePath = resolveDataFile("context", "historical.json");

    if (!fs.existsSync(filePath)) {
      return { version: 1, exportedAt: null, conversations: [] };
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const conversations = parseHistoricalExport(raw);

    return { conversations };
  }

  readInstagrams(): unknown[] {
    const store = new InstagramStore(resolveDataFile("context", "instagrams.json"));

    return store.loadAll();
  }

  readUnmatches(): unknown[] {
    const store = new UnmatchStore(resolveDataFile("context", "unmatches.json"));

    return store.loadAll();
  }

  readRuntimeContext(): unknown[] {
    const filePath = resolveDataFile("context", "runtime-context.json");

    return readJsonFile(filePath, []);
  }

  readAnalysisReport(): AnalysisReportData {
    const reportPath = resolveDataFile("context", "analysis-report.md");
    const metricsPath = resolveDataFile("context", "analysis-metrics.json");

    return {
      markdown: fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf-8") : null,
      metrics: fs.existsSync(metricsPath)
        ? JSON.parse(fs.readFileSync(metricsPath, "utf-8"))
        : null,
    };
  }
}
