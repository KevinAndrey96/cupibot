import fs from "node:fs";
import path from "node:path";
import {
  computeAnalysisMetrics,
  formatConversationSample,
  pickConversationSamples,
} from "../../domain/analysis-metrics.js";
import type { AnalysisConfig } from "../../config/analysis-config.js";
import { resolveDataPath } from "../../config/data-dir.js";
import type {
  Conversation,
  InstagramEntry,
  UnmatchEntry,
  AnalysisReport,
  ConversationAnalyzerPort,
} from "../../domain/types.js";
import { AiConsultationError } from "./ai-error.js";

interface OllamaResponse {
  response: string;
}

export type { AnalysisReport } from "../../domain/types.js";

interface OllamaResponse {
  response: string;
}

export class ConversationAnalyzer implements ConversationAnalyzerPort {
  constructor(
    private readonly ollamaUrl: string,
    private readonly model: string,
    private readonly config: AnalysisConfig,
  ) {}

  async generateReport(
    conversations: Conversation[],
    unmatches: UnmatchEntry[],
    instagrams: InstagramEntry[],
  ): Promise<AnalysisReport> {
    const metrics = computeAnalysisMetrics(conversations, unmatches, instagrams);
    const samples = pickConversationSamples(
      conversations,
      this.config.maxConversationSamples,
    );
    const recentUnmatches = unmatches.slice(-15);

    const prompt = this.config.systemPrompt
      .replace("{metricsJson}", JSON.stringify(metrics, null, 2))
      .replace(
        "{conversationSamples}",
        samples.length > 0
          ? samples.map((c) => formatConversationSample(c)).join("\n\n")
          : "(sin conversaciones con mensajes)",
      )
      .replace("{unmatchesJson}", JSON.stringify(recentUnmatches, null, 2))
      .replace("{instagramsJson}", JSON.stringify(instagrams, null, 2));

    console.log("[Análisis] generating AI report...");

    const reportMarkdown = await this.query(prompt);
    const generatedAt = new Date().toISOString();

    this.persistReport({
      generatedAt,
      metrics,
      reportMarkdown,
    });

    return { generatedAt, metrics, reportMarkdown };
  }

  private persistReport(report: AnalysisReport): void {
    const contextDir = resolveDataPath("context");
    const reportPath = path.join(contextDir, "analysis-report.md");
    const metricsPath = path.join(contextDir, "analysis-metrics.json");

    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    const header = `# Informe de análisis - ${report.generatedAt}\n\n`;
    fs.writeFileSync(reportPath, header + report.reportMarkdown, "utf-8");

    fs.writeFileSync(
      metricsPath,
      JSON.stringify(
        { generatedAt: report.generatedAt, metrics: report.metrics },
        null,
        2,
      ),
      "utf-8",
    );

    console.log(`[Análisis] report saved to ${reportPath}`);
    console.log(`[Análisis] metrics saved to ${metricsPath}`);
  }

  private async query(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: 2_500,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AiConsultationError(
          "conversation analysis",
          `ollama responded with status ${response.status}`,
        );
      }

      const data = (await response.json()) as OllamaResponse;

      return data.response.trim();
    } catch (error) {
      if (error instanceof AiConsultationError) {
        throw error;
      }

      throw new AiConsultationError("conversation analysis", error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
