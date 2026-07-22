import { describe, expect, it, vi } from "vitest";
import { MatchHandler } from "../src/application/match-handler.js";
import type {
  ProfileClassifierPort,
  ProfileInfo,
  StatsTrackerPort,
  SwipePagePort,
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

  const classifier: ProfileClassifierPort = {
    classify: vi.fn(),
    personalizeOpener: vi.fn().mockResolvedValue("hola personalizado"),
  };

  return { statsTracker, swipePage, classifier };
}

describe("MatchHandler", () => {
  it("stops the session when out of likes is detected", async () => {
    const mocks = createMocks();
    mocks.swipePage.hasOutOfLikes = vi.fn().mockResolvedValue(true);

    const handler = new MatchHandler(
      mocks.swipePage,
      mocks.statsTracker,
      mocks.classifier,
      { messages: ["hola"], personalizePrompt: "" },
      true,
    );

    const shouldStop = await handler.handlePopups(createProfile());

    expect(shouldStop).toBe(true);
    expect(mocks.statsTracker.recordMatch).not.toHaveBeenCalled();
  });

  it("records a match and dismisses the popup without sending an opener", async () => {
    const mocks = createMocks();
    mocks.swipePage.hasMatchPopup = vi.fn().mockResolvedValue(true);

    const handler = new MatchHandler(
      mocks.swipePage,
      mocks.statsTracker,
      mocks.classifier,
      { messages: ["hola"], personalizePrompt: "" },
      false,
    );

    const shouldStop = await handler.handlePopups(createProfile());

    expect(shouldStop).toBe(false);
    expect(mocks.statsTracker.recordMatch).toHaveBeenCalled();
    expect(mocks.swipePage.sendMatchMessage).not.toHaveBeenCalled();
    expect(mocks.swipePage.dismissPopup).toHaveBeenCalled();
  });

  it("sends a personalized opener when enabled", async () => {
    const mocks = createMocks();
    mocks.swipePage.hasMatchPopup = vi.fn().mockResolvedValue(true);
    const profile = createProfile();

    const handler = new MatchHandler(
      mocks.swipePage,
      mocks.statsTracker,
      mocks.classifier,
      { messages: ["hola"], personalizePrompt: "" },
      true,
    );

    await handler.handlePopups(profile);

    expect(mocks.classifier.personalizeOpener).toHaveBeenCalledWith(profile, "hola");
    expect(mocks.swipePage.sendMatchMessage).toHaveBeenCalledWith("hola personalizado");
    expect(mocks.statsTracker.recordMessageSent).toHaveBeenCalled();
  });

  it("dismisses generic popups before continuing", async () => {
    const mocks = createMocks();
    mocks.swipePage.hasPopup = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    const handler = new MatchHandler(
      mocks.swipePage,
      mocks.statsTracker,
      null,
      { messages: ["hola"], personalizePrompt: "" },
      false,
    );

    const shouldStop = await handler.handlePopups(null);

    expect(shouldStop).toBe(false);
    expect(mocks.swipePage.dismissPopup).toHaveBeenCalledTimes(2);
  });
});
