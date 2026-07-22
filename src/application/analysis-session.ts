import type {
  ChatPagePort,
  ConversationAnalyzerPort,
  ConversationStorePort,
  AnalysisReport,
} from "../domain/types.js";
import { detectUnmatches, type UnmatchDetectorDeps } from "./unmatch-detector.js";

export interface AnalysisRunResult {
  conversationsSynced: number;
  report: AnalysisReport | null;
}

export class AnalysisSession {
  private aborted = false;

  constructor(
    private readonly chatPage: ChatPagePort,
    private readonly conversationStore: ConversationStorePort,
    private readonly unmatchDeps: UnmatchDetectorDeps,
    private readonly analyzer: ConversationAnalyzerPort | null,
  ) {}

  abort(): void {
    this.aborted = true;
  }

  async run(): Promise<AnalysisRunResult> {
    console.log("[Análisis] starting conversation sync...");
    await this.chatPage.navigateToMessages();

    const synced = new Set<string>();
    let noNewCount = 0;
    const maxNoNew = 3;

    while (!this.aborted && noNewCount < maxNoNew) {
      const previews = await this.chatPage.getConversationPreviews();
      const fresh = previews.filter((p) => !synced.has(p.platformId || p.name));

      if (fresh.length === 0) {
        await this.chatPage.scrollConversationList();
        noNewCount++;

        continue;
      }

      noNewCount = 0;

      for (const preview of fresh) {
        if (this.aborted) {
          break;
        }

        const key = preview.platformId || preview.name;
        synced.add(key);

        if (this.isSystemConversation(preview.name)) {
          console.log(`[Análisis] ${preview.name} - system, skipped`);

          continue;
        }

        try {
          await this.chatPage.openConversation(preview);
          const messages = await this.chatPage.readMessages();

          if (messages.length > 0) {
            this.conversationStore.merge(preview.platformId, preview.name, messages);
            console.log(`[Análisis] ${preview.name}: ${messages.length} messages synced`);
          } else {
            console.log(`[Análisis] ${preview.name}: no messages found`);
          }
        } catch (error) {
          console.error(
            `[Análisis] ${preview.name}: ${error instanceof Error ? error.message : error}`,
          );
        }

        await this.chatPage.goBackToConversationList();
      }

      await this.chatPage.scrollConversationList();
    }

    await this.chatPage.navigateToMessages();
    const allVisible = await this.chatPage.getAllVisibleConversations();

    detectUnmatches(allVisible, this.unmatchDeps, "[Análisis]");

    this.conversationStore.exportHistorical();
    console.log(`[Análisis] sync done. ${synced.size} conversations processed.`);

    let report: AnalysisReport | null = null;

    if (this.analyzer) {
      const entries = this.conversationStore.listAll();
      const conversations = entries.map((e) =>
        this.conversationStore.load(e.platformId, e.name),
      );

      report = await this.analyzer.generateReport(
        conversations,
        this.unmatchDeps.unmatchStore.loadAll(),
        this.unmatchDeps.instagramStore.loadAll(),
      );

      console.log("\n[Análisis] ── AI report ──\n");
      console.log(report.reportMarkdown);
    }

    return {
      conversationsSynced: synced.size,
      report,
    };
  }

  private isSystemConversation(name: string): boolean {
    return this.unmatchDeps.systemConversations.has(name.toLowerCase().trim());
  }
}
