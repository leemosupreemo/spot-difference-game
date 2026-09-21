import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initAnalytics,
  trackCategorySelected,
  trackGameStarted,
  trackImagePairCompleted,
  trackStageCleared,
  trackStageFailed,
  trackRatingPromptShown,
  trackRatingPromptAction,
  trackResultScreenViewed,
  trackChallengeShareClicked,
  trackChallengeShareCompleted,
  trackChallengeShareCancelled,
  trackChallengeReceived,
  trackChallengeMatchCompleted,
  trackNotificationScheduled,
  trackNotificationPermissionResult,
  trackNotificationClicked,
  trackMainMenuViewed,
  trackDailyChallengeImpression,
  trackDailyChallengeClicked,
  trackDailyChallengeStarted,
  trackDailyChallengeCompleted,
  trackHelpTapped,
  trackHelpTabSwitched,
  trackAppError,
  identifyPlayer,
  resetAnalyticsUser
} from "./analytics.js";

test("initializes analytics safely without throwing in any environment", () => {
  assert.doesNotThrow(() => {
    initAnalytics();
  });
});

test("tracks category selection with photorealistic vs abstract designations", () => {
  assert.doesNotThrow(() => {
    trackCategorySelected("find_the_sniper");
    trackCategorySelected("abstract_animated");
  });
});

test("tracks game launch with category, difficulty, and mode parameters", () => {
  assert.doesNotThrow(() => {
    trackGameStarted({
      themeId: "find_the_sniper",
      difficulty: "Medium",
      mode: "classic"
    });
    trackGameStarted({
      themeId: "abstract_animated",
      difficulty: "Hard",
      mode: "blitz"
    });
  });
});

test("tracks image pair win and loss with unique completion metrics", () => {
  const mockLevel = {
    id: "test_photo_level_001",
    title: "Test Artisan Level",
    packId: "find_the_sniper",
    operation: "recolor"
  };

  // 1. First time win
  assert.doesNotThrow(() => {
    trackImagePairCompleted({
      result: "win",
      level: mockLevel,
      selectedTheme: "find_the_sniper",
      elapsedTimeMs: 4200,
      missCount: 0,
      hintsUsed: 0,
      scoreEarned: 450,
      stageIndex: 0
    });
  });

  // 2. Repeat win
  assert.doesNotThrow(() => {
    trackImagePairCompleted({
      result: "win",
      level: mockLevel,
      selectedTheme: "find_the_sniper",
      elapsedTimeMs: 3100,
      missCount: 1,
      hintsUsed: 1,
      scoreEarned: 420,
      stageIndex: 1
    });
  });

  // 3. Loss (Strike out)
  assert.doesNotThrow(() => {
    trackImagePairCompleted({
      result: "lose",
      level: mockLevel,
      selectedTheme: "find_the_sniper",
      setId: "photo_set_001",
      isFirstAttempt: true,
      gameMode: "standard",
      elapsedTimeMs: 12000,
      missCount: 3,
      hintsUsed: 2,
      scoreEarned: 0,
      stageIndex: 2
    });
  });

  // 4. Abandoned / Quit
  assert.doesNotThrow(() => {
    trackImagePairCompleted({
      result: "abandoned",
      level: mockLevel,
      selectedTheme: "find_the_sniper",
      setId: "photo_set_001",
      isFirstAttempt: false,
      gameMode: "standard",
      elapsedTimeMs: 8500,
      missCount: 1,
      hintsUsed: 0,
      scoreEarned: 0,
      stageIndex: 1
    });
  });
});

test("tracks full 5-image stage clearance", () => {
  assert.doesNotThrow(() => {
    trackStageCleared({
      selectedTheme: "find_the_sniper",
      setId: "photo_set_001",
      selectedDifficulty: "Medium",
      totalStageTimeMs: 18500,
      totalStageScore: 2150,
      imagesInStageCount: 5,
      isFirstAttempt: true,
      gameMode: "standard"
    });
  });
});

test("tracks stage set failures and forfeits properly", () => {
  assert.doesNotThrow(() => {
    trackStageFailed({
      selectedTheme: "find_the_sniper",
      setId: "photo_set_001",
      selectedDifficulty: "Medium",
      totalStageTimeMs: 14000,
      stageIndexFailed: 2,
      failedLevelId: "test_photo_level_001",
      imagesInStageCount: 5,
      isFirstAttempt: true,
      gameMode: "standard",
      reason: "three_strikes"
    });

    trackStageFailed({
      selectedTheme: "find_the_sniper",
      setId: "photo_set_001",
      selectedDifficulty: "Medium",
      totalStageTimeMs: 7000,
      stageIndexFailed: 1,
      failedLevelId: "test_photo_level_001",
      imagesInStageCount: 5,
      isFirstAttempt: false,
      gameMode: "standard",
      reason: "abandoned"
    });
  });
});

test("tracks rating prompt impressions and user actions", () => {
  assert.doesNotThrow(() => {
    trackRatingPromptShown({ attemptNumber: 1, successfulRounds: 5 });
    trackRatingPromptAction({ action: "rate", attemptNumber: 1 });
    trackRatingPromptAction({ action: "dismiss", attemptNumber: 1 });
  });
});

test("tracks challenge and result screen funnel events properly", () => {
  assert.doesNotThrow(() => {
    trackResultScreenViewed({
      elapsedTimeMs: 2430,
      isPersonalBest: true,
      score: 480,
      stars: 3,
      difficulty: "Medium",
      themeId: "find_the_sniper"
    });

    trackChallengeShareClicked({
      source: "victory_modal_cta",
      elapsedTimeMs: 2430,
      isPersonalBest: true
    });

    trackChallengeShareCompleted({
      method: "native_share",
      elapsedTimeMs: 2430,
      isPersonalBest: true
    });

    trackChallengeShareCancelled({
      reason: "dismissed",
      elapsedTimeMs: 2430
    });

    trackChallengeReceived({
      challengerName: "Alex",
      targetTimeSec: 2.43
    });

    trackChallengeMatchCompleted({
      challengerName: "Alex",
      targetTimeSec: 2.43,
      playerTimeSec: 2.18,
      playerWon: true
    });
  });
});

test("tracks notification lifecycle events properly", () => {
  assert.doesNotThrow(() => {
    trackNotificationScheduled({
      welcomeAt: new Date().toISOString(),
      reminderAt: new Date().toISOString(),
      granted: true
    });

    trackNotificationPermissionResult({
      status: "granted",
      granted: true
    });

    trackNotificationClicked({
      notificationId: 1001,
      title: "Spot the difference?",
      actionId: "tap"
    });
  });
});

test("identifies player and resets user without throwing", () => {
  assert.doesNotThrow(() => {
    identifyPlayer("player_12345", {
      "Hunter Tag": "ApexSpotter",
      "Player Name": "ApexSpotter"
    });
    resetAnalyticsUser();
  });
});

test("tracks main menu view, daily challenge funnel, and help interactions without throwing", () => {
  assert.doesNotThrow(() => {
    trackMainMenuViewed({ selectedTheme: "find_the_sniper" });
    trackMainMenuViewed({ selectedTheme: "abstract_animated" });

    trackDailyChallengeImpression({
      date: "2026-09-20",
      timeToBeatSec: 15.5,
      hasAttempted: false,
      isCompleted: false
    });

    trackDailyChallengeClicked({
      source: "main_banner",
      date: "2026-09-20",
      isAttempted: false
    });

    trackDailyChallengeStarted({
      date: "2026-09-20",
      levelsCount: 3
    });

    trackDailyChallengeCompleted({
      date: "2026-09-20",
      totalTimeMs: 14200,
      stars: 3,
      position: 1,
      isNewRecord: true,
      isFailed: false
    });

    trackDailyChallengeCompleted({
      date: "2026-09-20",
      totalTimeMs: 12000,
      stars: 0,
      position: null,
      isNewRecord: false,
      isFailed: true
    });

    trackHelpTapped({ source: "header", view: "menu" });
    trackHelpTabSwitched({ tab: "privacy" });
    trackAppError({ errorMessage: "Canvas context lost", errorName: "RenderError" });
  });
});

