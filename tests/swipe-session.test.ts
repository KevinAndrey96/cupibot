import { describe, expect, it, vi } from "vitest";
import { SwipeSession } from "../src/application/swipe-session.js";
import {
  type ChatBreakPort,
  type DelayCalculatorPort,
  type MatchHandlerPort,
  type ProfileClassifierPort,
  type ProfileInfo,
  type SessionConfig,
  type StatsTrackerPort,
  type SwipePagePort,
} from "../src/domain/types.js";

function createProfile(overrides: Partial<ProfileInfo> = {}): ProfileInfo {
  return {
    name: "Ana",
    age: "24",
    bio: "hola",
    raw: "Ana 24 hola",
    photos: [],
    ...overrides,
  };
}

function createSessionConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    maxSwipes: 2,
    minDelayMs: 0,
    maxDelayMs: 0,
    batchPauseMinMs: 0,
    batchPauseMaxMs: 0,
    batchSizeMin: 1,
    batchSizeMax: 1,
    headless: true,
    swipeCooldownMs: 0,
    viewingDelayMaxMs: 0,
    restBreakMinMs: 0,
    restBreakMaxMs: 0,
    chatBreakResumeMs: 0,
    swipeModel: "test",
    ollamaUrl: "http://localhost",
    minAttractivenessScore: 6,
    chatBreakInterval: 100,
    onExtractFailure: "pass",
    ...overrides,
  };
}

function createMocks() {
  const statsTracker: StatsTrackerPort = {
    recordLike: vi.fn(),
    recordPass: vi.fn(),
    recordMatch: vi.fn(),
    recordMessageSent: vi.fn(),
    recordFiltered: vi.fn(),
    recordError: vi.fn(),
    finish: vi.fn(),
    summary: vi.fn(),
    printProgress: vi.fn(),
    printSummary: vi.fn(),
  };

  const swipePage: SwipePagePort = {
    navigate: vi.fn().mockResolvedValue(undefined),
    isOnSwipeScreen: vi.fn().mockResolvedValue(true),
    clickLike: vi.fn().mockResolvedValue(undefined),
    clickPass: vi.fn().mockResolvedValue(undefined),
    hasPopup: vi.fn().mockResolvedValue(false),
    hasMatchPopup: vi.fn().mockResolvedValue(false),
    sendMatchMessage: vi.fn().mockResolvedValue(true),
    dismissPopup: vi.fn().mockResolvedValue(undefined),
    hasOutOfLikes: vi.fn().mockResolvedValue(false),
    extractProfileInfo: vi.fn().mockResolvedValue(createProfile()),
    simulateProfileBrowsing: vi.fn().mockResolvedValue(undefined),
    simulateIdleBehavior: vi.fn().mockResolvedValue(undefined),
  };

  const delayCalculator: DelayCalculatorPort = {
    swipeDelay: vi.fn().mockReturnValue(0),
    batchPause: vi.fn().mockReturnValue(0),
    nextBatchSize: vi.fn().mockReturnValue(1),
    viewingDelay: vi.fn().mockReturnValue(0),
    restBreakDuration: vi.fn().mockReturnValue(0),
  };

  const matchHandler: MatchHandlerPort = {
    handlePopups: vi.fn().mockResolvedValue(false),
  };

  const classifier: ProfileClassifierPort = {
    classify: vi.fn().mockResolvedValue({ approved: true }),
    personalizeOpener: vi.fn().mockResolvedValue("hola"),
  };

  return {
    statsTracker,
    swipePage,
    delayCalculator,
    matchHandler,
    classifier,
  };
}

describe("SwipeSession", () => {
  it("completes after reaching max swipes with approved profiles", async () => {
    const mocks = createMocks();

    const session = new SwipeSession(
      mocks.swipePage,
      mocks.delayCalculator,
      mocks.matchHandler,
      mocks.statsTracker,
      createSessionConfig({ maxSwipes: 2 }),
      mocks.classifier,
      null,
    );

    const result = await session.run();

    expect(result.reason).toBe("completed");
    expect(mocks.swipePage.clickLike).toHaveBeenCalledTimes(2);
    expect(mocks.statsTracker.recordLike).toHaveBeenCalledTimes(2);
  });

  it("swipes left when the classifier rejects a profile", async () => {
    const mocks = createMocks();
    mocks.classifier.classify = vi.fn().mockResolvedValue({
      approved: false,
      rejectedBy: "gender",
    });

    const session = new SwipeSession(
      mocks.swipePage,
      mocks.delayCalculator,
      mocks.matchHandler,
      mocks.statsTracker,
      createSessionConfig({ maxSwipes: 1 }),
      mocks.classifier,
      null,
    );

    await session.run();

    expect(mocks.swipePage.clickPass).toHaveBeenCalledTimes(1);
    expect(mocks.statsTracker.recordFiltered).toHaveBeenCalledWith("gender");
    expect(mocks.swipePage.clickLike).not.toHaveBeenCalled();
  });

  it("returns aborted when stop is requested", async () => {
    const mocks = createMocks();

    const session = new SwipeSession(
      mocks.swipePage,
      mocks.delayCalculator,
      mocks.matchHandler,
      mocks.statsTracker,
      createSessionConfig({ maxSwipes: 10 }),
      mocks.classifier,
      null,
    );

    session.abort();
    const result = await session.run();

    expect(result.reason).toBe("aborted");
    expect(mocks.matchHandler.handlePopups).not.toHaveBeenCalled();
    expect(mocks.swipePage.clickLike).not.toHaveBeenCalled();
  });

  it("stops when the match handler reports out of likes", async () => {
    const mocks = createMocks();
    mocks.matchHandler.handlePopups = vi.fn().mockResolvedValue(true);

    const session = new SwipeSession(
      mocks.swipePage,
      mocks.delayCalculator,
      mocks.matchHandler,
      mocks.statsTracker,
      createSessionConfig({ maxSwipes: 5 }),
      mocks.classifier,
      null,
    );

    const result = await session.run();

    expect(result.reason).toBe("out_of_likes");
    expect(mocks.swipePage.clickLike).not.toHaveBeenCalled();
  });

  it("likes on extract failure when configured to do so", async () => {
    const mocks = createMocks();
    mocks.swipePage.extractProfileInfo = vi.fn().mockResolvedValue(null);

    const session = new SwipeSession(
      mocks.swipePage,
      mocks.delayCalculator,
      mocks.matchHandler,
      mocks.statsTracker,
      createSessionConfig({ maxSwipes: 1, onExtractFailure: "like" }),
      mocks.classifier,
      null,
    );

    await session.run();

    expect(mocks.classifier.classify).not.toHaveBeenCalled();
    expect(mocks.swipePage.clickLike).toHaveBeenCalledTimes(1);
  });

  it("runs a chat break after the configured swipe interval", async () => {
    const mocks = createMocks();
    const chatBreak: ChatBreakPort = {
      runCycle: vi.fn().mockResolvedValue(undefined),
    };
    const onChatBreakStart = vi.fn().mockResolvedValue(undefined);
    const onChatBreakEnd = vi.fn().mockResolvedValue(undefined);

    const session = new SwipeSession(
      mocks.swipePage,
      mocks.delayCalculator,
      mocks.matchHandler,
      mocks.statsTracker,
      createSessionConfig({ maxSwipes: 3, chatBreakInterval: 1 }),
      mocks.classifier,
      chatBreak,
      onChatBreakStart,
      onChatBreakEnd,
    );

    await session.run();

    expect(chatBreak.runCycle).toHaveBeenCalledTimes(2);
    expect(onChatBreakStart).toHaveBeenCalledTimes(2);
    expect(onChatBreakEnd).toHaveBeenCalledTimes(2);
    expect(mocks.swipePage.navigate).toHaveBeenCalledTimes(2);
  });
});
