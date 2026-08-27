import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initAnalytics,
  trackCategorySelected,
  trackGameStarted,
  trackImagePairCompleted,
  trackStageCleared
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
      elapsedTimeMs: 12000,
      missCount: 3,
      hintsUsed: 2,
      scoreEarned: 0,
      stageIndex: 2
    });
  });
});

test("tracks full 5-image stage clearance", () => {
  assert.doesNotThrow(() => {
    trackStageCleared({
      selectedTheme: "find_the_sniper",
      selectedDifficulty: "Medium",
      totalStageTimeMs: 18500,
      totalStageScore: 2150,
      imagesInStageCount: 5
    });
  });
});
