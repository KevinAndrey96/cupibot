import { describe, expect, it } from "vitest";
import {
  computeAnalysisMetrics,
  pickConversationSamples,
} from "../src/domain/analysis-metrics.js";
import type { Conversation } from "../src/domain/types.js";

describe("computeAnalysisMetrics", () => {
  const conversations: Conversation[] = [
    {
      name: "Ana",
      platformId: "a1",
      messages: [
        { sender: "me", content: "hola", timestamp: new Date() },
        { sender: "them", content: "que mas", timestamp: new Date() },
      ],
    },
    {
      name: "Lu",
      platformId: "l1",
      messages: [
        { sender: "them", content: "hey", timestamp: new Date() },
      ],
    },
    {
      name: "Empty",
      platformId: "e1",
      messages: [],
    },
  ];

  it("computes reply and message stats", () => {
    const metrics = computeAnalysisMetrics(conversations, [], []);

    expect(metrics.totalConversations).toBe(3);
    expect(metrics.totalMessages).toBe(3);
    expect(metrics.conversationsWithTheirReply).toBe(2);
    expect(metrics.replyRatePercent).toBe(100);
    expect(metrics.emptyConversations).toBe(1);
  });

  it("computes unmatch breakdown", () => {
    const metrics = computeAnalysisMetrics(conversations, [
      {
        name: "X",
        platformId: "x1",
        detectedAt: new Date().toISOString(),
        lastMessageSender: "me",
        lastMessageContent: "hola",
        totalMessages: 2,
        hadInstagram: false,
      },
    ], []);

    expect(metrics.unmatchCount).toBe(1);
    expect(metrics.unmatchAfterMyMessage).toBe(1);
  });
});

describe("pickConversationSamples", () => {
  it("returns longest conversations first", () => {
    const conversations: Conversation[] = [
      { name: "A", platformId: "1", messages: [{ sender: "me", content: "a", timestamp: new Date() }] },
      {
        name: "B",
        platformId: "2",
        messages: [
          { sender: "me", content: "a", timestamp: new Date() },
          { sender: "them", content: "b", timestamp: new Date() },
          { sender: "me", content: "c", timestamp: new Date() },
        ],
      },
    ];

    const samples = pickConversationSamples(conversations, 1);

    expect(samples[0].name).toBe("B");
  });
});
