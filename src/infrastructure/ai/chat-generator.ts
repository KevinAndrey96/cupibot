import type { AiConfigBundle } from "../../config/ai-config.js";
import { AiConsultationError } from "./ai-error.js";
import { validateChatMessage } from "./chat-message-validator.js";
import { parseChatResponse } from "./chat-response-parser.js";
import type {
  ChatGeneratorPort,
  ChatGeneratorResult,
  Conversation,
  PersonalContextEntry,
} from "../../domain/types.js";

interface OllamaResponse {
  response: string;
}

export class ChatGenerator implements ChatGeneratorPort {
  constructor(
    private readonly ollamaUrl: string,
    private readonly model: string,
    private readonly aiConfig: AiConfigBundle,
  ) {}

  async generateReply(
    conversation: Conversation,
    personalContext: PersonalContextEntry[],
  ): Promise<ChatGeneratorResult> {
    const { chat } = this.aiConfig;
    const knownContextBlock = this.buildContextBlock(personalContext);
    const historyBlock = this.buildHistoryBlock(conversation);
    const phaseHint = this.buildPhaseHint(conversation);

    const prompt = chat.systemPrompt
      .replace("{knownContext}", knownContextBlock)
      .replace("{history}", historyBlock)
      .replace("{instagramHandle}", chat.instagramHandle)
      + phaseHint;

    const lastThemMessage = [...conversation.messages]
      .reverse()
      .find((m) => m.sender === "them")?.content ?? "";

    let currentPrompt = prompt;

    for (let attempt = 0; attempt <= chat.maxRetries; attempt++) {
      const raw = await this.query(currentPrompt);
      const { message, unknownQuestions } = parseChatResponse(
        raw,
        chat.personaName,
        chat.instagramHandle,
      );
      const violations = validateChatMessage(message, lastThemMessage, {
        bannedPhrases: chat.bannedPhrases,
        bannedEmojis: chat.bannedEmojis,
      });

      if (violations.length === 0) {
        return { message, unknownQuestions };
      }

      console.log(
        `[Chat] response rejected (attempt ${attempt + 1}/${chat.maxRetries + 1}): ${violations.join(", ")}`,
      );
      console.log(`[Chat] rejected message: "${message}"`);

      if (attempt === chat.maxRetries) {
        throw new AiConsultationError(
          "chat reply generation",
          `could not produce natural reply after ${chat.maxRetries + 1} attempts: ${violations.join(", ")}`,
        );
      }

      currentPrompt = `${prompt}\n\n` +
        `RECHAZADO (intento ${attempt + 1}). Problemas detectados:\n` +
        `${violations.map((v) => `- ${v}`).join("\n")}\n` +
        "Reescribe SOLO el mensaje de Kevin evitando esos problemas. Sin explicaciones.";
    }

    return { message: "", unknownQuestions: [] };
  }

  private buildPhaseHint(conversation: Conversation): string {
    const { chat } = this.aiConfig;
    const theirMessages = conversation.messages.filter((m) => m.sender === "them");
    const totalExchanges = Math.min(
      conversation.messages.filter((m) => m.sender === "me").length,
      theirMessages.length,
    );

    if (totalExchanges >= 6) {
      return chat.phaseHints.instagram6;
    }

    if (totalExchanges >= 4) {
      return chat.phaseHints.rapport4;
    }

    return "";
  }

  private buildContextBlock(entries: PersonalContextEntry[]): string {
    if (entries.length === 0) {
      return "Additional personal Q&A: (none yet)";
    }

    const lines = entries.map((e) => `- Q: ${e.question} → A: ${e.answer}`);

    return `Additional personal Q&A (from past conversations):\n${lines.join("\n")}`;
  }

  private buildHistoryBlock(conversation: Conversation): string {
    const { chat } = this.aiConfig;
    const personaName = chat.personaName;

    if (conversation.messages.length === 0) {
      return "(No messages yet - you are starting the conversation)";
    }

    const recent = conversation.messages.slice(-chat.maxHistoryMessages);

    return recent
      .map((m) => {
        const label = m.sender === "me" ? personaName : conversation.name;

        return `${label}: ${m.content}`;
      })
      .join("\n");
  }

  private async query(prompt: string): Promise<string> {
    const { chat } = this.aiConfig;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), chat.timeoutMs);

    const body = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: chat.temperature,
        num_predict: 120,
      },
    };

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AiConsultationError(
          "chat reply generation",
          `ollama responded with status ${response.status}`,
        );
      }

      const data = (await response.json()) as OllamaResponse;

      return data.response;
    } catch (error) {
      if (error instanceof AiConsultationError) {
        throw error;
      }

      throw new AiConsultationError("chat reply generation", error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
