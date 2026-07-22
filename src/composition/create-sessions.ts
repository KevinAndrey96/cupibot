import type { Page } from "playwright";
import { AnalysisSession } from "../application/analysis-session.js";
import { ChatSession } from "../application/chat-session.js";
import {
  buildChatConfig,
  buildChatSessionConfig,
  type ResolvedAppConfig,
} from "../config/app-config.js";
import { loadAiConfig } from "../config/ai-config.js";
import { loadAnalysisConfig } from "../config/analysis-config.js";
import type { Platform } from "../domain/types.js";
import { ChatGenerator } from "../infrastructure/ai/chat-generator.js";
import { ConversationAnalyzer } from "../infrastructure/ai/conversation-analyzer.js";
import { ConversationStore } from "../infrastructure/storage/conversation-store.js";
import { PersonalContextStore } from "../infrastructure/storage/personal-context-store.js";
import { InstagramStore } from "../infrastructure/storage/instagram-store.js";
import { UnmatchStore } from "../infrastructure/storage/unmatch-store.js";
import { createChatPage } from "./create-pages.js";

export function createChatSession(
  page: Page,
  platform: Platform,
  appConfig: ResolvedAppConfig,
): ChatSession {
  const aiConfig = loadAiConfig();
  const chatConfig = buildChatConfig(appConfig);
  const sessionConfig = buildChatSessionConfig(aiConfig);

  return new ChatSession(
    createChatPage(platform, page),
    new ChatGenerator(appConfig.ollama.url, appConfig.ollama.chatModel, aiConfig),
    new ConversationStore(),
    new PersonalContextStore(aiConfig.personalContext),
    new InstagramStore(),
    new UnmatchStore(),
    chatConfig,
    sessionConfig,
  );
}

export function createAnalysisSession(
  page: Page,
  platform: Platform,
  appConfig: ResolvedAppConfig,
): AnalysisSession {
  const aiConfig = loadAiConfig();
  const analysisConfig = loadAnalysisConfig();
  const sessionConfig = buildChatSessionConfig(aiConfig);
  const conversationStore = new ConversationStore();
  const unmatchStore = new UnmatchStore();
  const instagramStore = new InstagramStore();

  const analyzer = new ConversationAnalyzer(
    appConfig.ollama.url,
    appConfig.ollama.chatModel,
    analysisConfig,
  );

  return new AnalysisSession(
    createChatPage(platform, page),
    conversationStore,
    {
      conversationStore,
      unmatchStore,
      instagramStore,
      systemConversations: sessionConfig.systemConversations,
    },
    analyzer,
  );
}
