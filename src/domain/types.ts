import type { Page, BrowserContext } from "playwright";

export type Platform = "tinder" | "bumble";

export enum SwipeDirection {
  RIGHT = "right",
  LEFT = "left",
}

export interface SessionConfig {
  maxSwipes: number;
  minDelayMs: number;
  maxDelayMs: number;
  batchPauseMinMs: number;
  batchPauseMaxMs: number;
  batchSizeMin: number;
  batchSizeMax: number;
  headless: boolean;
  swipeCooldownMs: number;
  viewingDelayMaxMs: number;
  restBreakMinMs: number;
  restBreakMaxMs: number;
  chatBreakResumeMs: number;
  swipeModel: string;
  ollamaUrl: string;
  minAttractivenessScore: number;
  chatBreakInterval: number;
  onExtractFailure: "like" | "pass";
}

export interface ProfileInfo {
  name: string;
  age: string;
  bio: string;
  raw: string;
  photos: string[];
}

export interface SessionStats {
  likes: number;
  passes: number;
  matches: number;
  messagesSent: number;
  filtered: number;
  errors: number;
  startedAt: Date;
  endedAt: Date | null;
}


export interface DelayCalculatorPort {
  swipeDelay(): number;
  batchPause(): number;
  nextBatchSize(): number;
  viewingDelay(): number;
  restBreakDuration(): number;
}

export interface FilterBreakdown {
  name: number;
  gender: number;
  body: number;
  score: number;
  text: number;
}

export interface StatsTrackerPort {
  recordLike(): void;
  recordPass(): void;
  recordMatch(): void;
  recordMessageSent(): void;
  recordFiltered(stage: FilterStage): void;
  recordError(): void;
  finish(): void;
  summary(): SessionStats;
  printProgress(current: number, max: number): void;
  printSummary(): void;
}

export interface SwipePagePort {
  navigate(): Promise<void>;
  isOnSwipeScreen(): Promise<boolean>;
  clickLike(): Promise<void>;
  clickPass(): Promise<void>;
  hasPopup(): Promise<boolean>;
  hasMatchPopup(): Promise<boolean>;
  sendMatchMessage(message: string): Promise<boolean>;
  dismissPopup(): Promise<void>;
  hasOutOfLikes(): Promise<boolean>;
  extractProfileInfo(): Promise<ProfileInfo | null>;
  simulateProfileBrowsing(): Promise<void>;
  simulateIdleBehavior(durationMs: number): Promise<void>;
}

export interface MatchHandlerPort {
  handlePopups(lastProfile: ProfileInfo | null): Promise<boolean>;
}

export interface ChatBreakPort {
  runCycle(): Promise<void>;
}

export type FilterStage = "name" | "gender" | "body" | "score" | "text";

export interface ClassifierResult {
  approved: boolean;
  rejectedBy?: FilterStage;
}

export interface ProfileClassifierPort {
  classify(profile: ProfileInfo): Promise<ClassifierResult>;
  personalizeOpener(profile: ProfileInfo, baseOpener: string): Promise<string>;
}

export interface BrowserManagerPort {
  launch(): Promise<{ context: BrowserContext; page: Page }>;
  close(): Promise<void>;
}

// ── Chat types ──

export interface ChatConfig {
  chatDryRun: boolean;
  chatReplyAll: boolean;
  chatModel: string;
  chatSendDelayS: number;
  chatMaxConversations: number;
  chatCycleMinMin: number;
  chatCycleMaxMin: number;
  ollamaUrl: string;
  headless: boolean;
}

export interface ChatSessionConfig {
  personaName: string;
  instagramHandle: string;
  selfHandles: Set<string>;
  instagramAskPattern: RegExp;
  systemConversations: Set<string>;
  systemMessagePatterns: RegExp[];
}

export interface ChatMessage {
  sender: "me" | "them";
  content: string;
  timestamp: Date;
}

export interface Conversation {
  name: string;
  platformId: string;
  messages: ChatMessage[];
}

export interface ConversationPreview {
  name: string;
  platformId: string;
  index: number;
}

export interface VisibleConversation {
  name: string;
  platformId: string;
}

export interface ChatGeneratorResult {
  message: string;
  unknownQuestions: string[];
}

export interface PersonalContextEntry {
  question: string;
  answer: string;
  askedBy: string;
  askedAt: string;
}

export interface ChatPagePort {
  navigateToMessages(): Promise<void>;
  getConversationPreviews(): Promise<ConversationPreview[]>;
  getAllVisibleConversations(): Promise<VisibleConversation[]>;
  scrollConversationList(): Promise<void>;
  openConversation(preview: ConversationPreview): Promise<void>;
  getOpenConversationName(): Promise<string>;
  readMessages(): Promise<ChatMessage[]>;
  typeMessage(message: string): Promise<boolean>;
  confirmSend(): Promise<boolean>;
  sendMessage(message: string): Promise<boolean>;
  goBackToConversationList(): Promise<void>;
}

export interface ChatGeneratorPort {
  generateReply(
    conversation: Conversation,
    personalContext: PersonalContextEntry[],
  ): Promise<ChatGeneratorResult>;
}

export interface ConversationStorePort {
  load(platformId: string, name: string): Conversation;
  save(conversation: Conversation): void;
  merge(
    platformId: string,
    name: string,
    freshMessages: ChatMessage[],
  ): Conversation;
  listAll(): Array<{ name: string; platformId: string }>;
  exportHistorical(): void;
}

export interface PersonalContextStorePort {
  loadKnownContext(): PersonalContextEntry[];
  logUnknownQuestion(question: string, askedBy: string): void;
}

import type { AnalysisMetrics } from "./analysis-metrics.js";

export interface AnalysisReport {
  generatedAt: string;
  metrics: AnalysisMetrics;
  reportMarkdown: string;
}

export interface ConversationAnalyzerPort {
  generateReport(
    conversations: Conversation[],
    unmatches: UnmatchEntry[],
    instagrams: InstagramEntry[],
  ): Promise<AnalysisReport>;
}

export interface OllamaManagerPort {
  startServer(): Promise<void>;
  ensureReady(models: string[]): Promise<void>;
  activate(model: string): Promise<void>;
  releaseModels(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface InstagramEntry {
  name: string;
  platformId: string;
  handle: string;
  collectedAt: string;
  source: "them" | "detected";
}

export interface InstagramStorePort {
  save(entry: InstagramEntry): void;
  loadAll(): InstagramEntry[];
  hasInstagram(platformId: string): boolean;
}

export interface UnmatchEntry {
  name: string;
  platformId: string;
  detectedAt: string;
  lastMessageSender: "me" | "them";
  lastMessageContent: string;
  totalMessages: number;
  hadInstagram: boolean;
}

export interface UnmatchStorePort {
  save(entry: UnmatchEntry): void;
  loadAll(): UnmatchEntry[];
  isUnmatched(platformId: string): boolean;
}
