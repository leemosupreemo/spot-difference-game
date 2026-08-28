import mixpanel from "mixpanel-browser";
import { Capacitor } from "@capacitor/core";
import { logApp } from "../utils/logger.js";

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const MIXPANEL_TOKEN = env.VITE_MIXPANEL_TOKEN || "063a583465a765e3f8346253d15098d1";

let isInitialized = false;
let sessionStartTime = Date.now();
let sessionStats = {
  levelsPlayed: 0,
  wins: 0,
  losses: 0,
  categoriesPlayed: new Set()
};

function getIsoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function getStoredUniqueCompletedIds() {
  try {
    const raw = localStorage.getItem("diff_hunter_unique_completed_ids");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (_) {
    return new Set();
  }
}

function saveStoredUniqueCompletedIds(set) {
  try {
    localStorage.setItem("diff_hunter_unique_completed_ids", JSON.stringify(Array.from(set)));
  } catch (_) {}
}

export function initAnalytics() {
  if (isInitialized) return;

  const isTest = typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test";
  if (isTest || typeof window === "undefined") {
    isInitialized = true;
    return;
  }

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: Boolean(env.DEV),
      track_pageview: false,
      persistence: "localStorage",
      ignore_dnt: true,
      batch_requests: false
    });

    const platform = Capacitor.isNativePlatform() ? "ios" : "web";

    mixpanel.register({
      app_name: "DiffHunter",
      platform,
      screen_width: window.innerWidth,
      screen_height: window.innerHeight
    });

    isInitialized = true;
    logApp("INFO", `[Analytics] Mixpanel initialized on platform: ${platform}`);

    trackFirstLaunchAndVisits(platform);
    setupSessionDurationTracking();
  } catch (err) {
    console.warn("[Analytics] Mixpanel init warning:", err?.message || err);
  }
}

function trackFirstLaunchAndVisits(platform) {
  try {
    const now = new Date();
    const todayStr = getTodayDateString();
    const currentWeek = getIsoWeek(now);

    // 1. FIRST LAUNCH
    const isFirstLaunch = !localStorage.getItem("diff_hunter_first_launch_date");
    if (isFirstLaunch) {
      const firstLaunchIso = now.toISOString();
      localStorage.setItem("diff_hunter_first_launch_date", firstLaunchIso);

      trackEvent("First Launch", {
        first_launch_date: firstLaunchIso,
        platform
      });

      if (typeof window !== "undefined" && isInitialized && mixpanel?.people && mixpanel?.__loaded) {
        mixpanel.people.set_once({
          "$created": firstLaunchIso,
          "First Launch Date": firstLaunchIso,
          "Initial Platform": platform
        });
      }
    }

    // 2. VISITS PER WEEK & RETENTION
    let visitData = {
      totalVisits: 0,
      visitsThisWeek: 0,
      currentWeek: currentWeek,
      lastVisitDate: null,
      daysActiveCount: 0
    };

    try {
      const stored = localStorage.getItem("diff_hunter_visit_stats");
      if (stored) visitData = { ...visitData, ...JSON.parse(stored) };
    } catch (_) {}

    if (visitData.currentWeek !== currentWeek) {
      visitData.currentWeek = currentWeek;
      visitData.visitsThisWeek = 1;
    } else {
      visitData.visitsThisWeek = (visitData.visitsThisWeek || 0) + 1;
    }

    visitData.totalVisits = (visitData.totalVisits || 0) + 1;

    if (visitData.lastVisitDate !== todayStr) {
      visitData.daysActiveCount = (visitData.daysActiveCount || 0) + 1;
      visitData.lastVisitDate = todayStr;
    }

    localStorage.setItem("diff_hunter_visit_stats", JSON.stringify(visitData));

    trackEvent("App Open", {
      visit_number: visitData.totalVisits,
      visits_this_week: visitData.visitsThisWeek,
      iso_week: currentWeek,
      days_active_count: visitData.daysActiveCount,
      platform
    });

    if (mixpanel?.people) {
      mixpanel.people.set({
        "Last Active Date": now.toISOString(),
        "Visits This Week": visitData.visitsThisWeek,
        "Current ISO Week": currentWeek,
        "Days Active Count": visitData.daysActiveCount,
        "Total Visits": visitData.totalVisits
      });
    }
  } catch (err) {
    console.warn("[Analytics] First launch / visit tracking warning:", err);
  }
}

function setupSessionDurationTracking() {
  sessionStartTime = Date.now();

  const handleSessionEnd = () => {
    const durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
    if (durationSec >= 2) {
      trackEvent("Session End", {
        session_duration_sec: durationSec,
        session_duration_min: Number((durationSec / 60).toFixed(2)),
        levels_played: sessionStats.levelsPlayed,
        wins: sessionStats.wins,
        losses: sessionStats.losses,
        categories_played: Array.from(sessionStats.categoriesPlayed)
      });

      if (mixpanel?.people) {
        mixpanel.people.increment("Total Time Played Sec", durationSec);
        mixpanel.people.increment("Total Sessions", 1);
      }
    }
    sessionStartTime = Date.now();
  };

  window.addEventListener("beforeunload", handleSessionEnd);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      handleSessionEnd();
    } else if (document.visibilityState === "visible") {
      sessionStartTime = Date.now();
    }
  });
}

export function trackEvent(eventName, properties = {}) {
  try {
    if (!isInitialized) initAnalytics();

    const enriched = {
      ...properties,
      timestamp: new Date().toISOString(),
      session_time_elapsed_sec: Math.round((Date.now() - sessionStartTime) / 1000)
    };

    if (typeof window !== "undefined" && isInitialized && mixpanel?.track && mixpanel?.__loaded) {
      mixpanel.track(eventName, enriched);
    }
    logApp("INFO", `[Mixpanel] Track: ${eventName}`, enriched);
  } catch (err) {
    console.warn(`[Analytics] Track error on ${eventName}:`, err?.message || err);
  }
}

export function trackCategorySelected(themeId) {
  const categoryType = themeId === "abstract_animated" ? "abstract_generated" : "photorealistic";
  const categoryName = themeId === "abstract_animated" ? "Abstract" : "Photography";

  trackEvent("Category Selected", {
    theme_id: themeId,
    category_name: categoryName,
    category_type: categoryType
  });
}

export function trackGameStarted({ themeId, difficulty = "Medium", mode = "classic" }) {
  const categoryType = themeId === "abstract_animated" ? "abstract_generated" : "photorealistic";
  const categoryName = themeId === "abstract_animated" ? "Abstract" : "Photography";

  sessionStats.levelsPlayed += 1;
  sessionStats.categoriesPlayed.add(categoryType);

  trackEvent("Game Started", {
    theme_id: themeId,
    category_name: categoryName,
    category_type: categoryType,
    difficulty,
    mode
  });

  if (mixpanel?.people) {
    const propName = categoryType === "photorealistic" ? "Photorealistic Games Started" : "Abstract Games Started";
    mixpanel.people.increment(propName, 1);
    mixpanel.people.set({ "Last Selected Category": categoryName });
  }
}

export function trackImagePairCompleted({
  result = "win",
  level,
  selectedTheme,
  elapsedTimeMs = 0,
  missCount = 0,
  hintsUsed = 0,
  scoreEarned = 0,
  stageIndex = 0
}) {
  const levelId = level?.id || "unknown";
  const packId = level?.packId || selectedTheme || "find_the_sniper";
  const categoryType = (packId === "abstract_animated" || selectedTheme === "abstract_animated")
    ? "abstract_generated"
    : "photorealistic";
  const categoryName = categoryType === "abstract_generated" ? "Abstract" : "Photography";

  const isWin = result === "win";
  if (isWin) {
    sessionStats.wins += 1;
  } else {
    sessionStats.losses += 1;
  }

  const uniqueSet = getStoredUniqueCompletedIds();
  let isUniqueFirstTime = false;

  if (isWin && levelId !== "unknown") {
    if (!uniqueSet.has(levelId)) {
      uniqueSet.add(levelId);
      saveStoredUniqueCompletedIds(uniqueSet);
      isUniqueFirstTime = true;
    }
  }

  const totalUniqueCompleted = uniqueSet.size;

  trackEvent(isWin ? "Image Pair Completed" : "Image Pair Failed", {
    result,
    level_id: levelId,
    level_title: level?.title || "",
    pack_id: packId,
    category_name: categoryName,
    category_type: categoryType,
    operation: level?.operation || "unknown",
    is_unique_first_time: isUniqueFirstTime,
    total_unique_completed: totalUniqueCompleted,
    elapsed_time_sec: Math.round(elapsedTimeMs / 1000),
    elapsed_time_ms: elapsedTimeMs,
    miss_count: missCount,
    hints_used: hintsUsed,
    score_earned: scoreEarned,
    stage_image_number: stageIndex + 1
  });

  if (mixpanel?.people) {
    if (isWin) {
      mixpanel.people.increment("Total Image Pairs Won", 1);
      if (isUniqueFirstTime) {
        mixpanel.people.set({ "Total Unique Pairs Completed": totalUniqueCompleted });
        mixpanel.people.increment("Unique Pairs Completed Count", 1);
      }
    } else {
      mixpanel.people.increment("Total Image Pairs Lost", 1);
    }
  }
}

export function trackStageCleared({
  selectedTheme,
  selectedDifficulty = "Medium",
  totalStageTimeMs = 0,
  totalStageScore = 0,
  imagesInStageCount = 5
}) {
  const categoryType = selectedTheme === "abstract_animated" ? "abstract_generated" : "photorealistic";
  const categoryName = categoryType === "abstract_generated" ? "Abstract" : "Photography";
  const totalUniqueCompleted = getStoredUniqueCompletedIds().size;

  trackEvent("Stage Set Cleared", {
    theme_id: selectedTheme,
    category_name: categoryName,
    category_type: categoryType,
    difficulty: selectedDifficulty,
    total_stage_time_sec: Math.round(totalStageTimeMs / 1000),
    total_stage_time_ms: totalStageTimeMs,
    total_stage_score: totalStageScore,
    images_in_stage_count: imagesInStageCount,
    total_unique_completed: totalUniqueCompleted
  });

  if (mixpanel?.people) {
    mixpanel.people.increment("Total Stages Cleared", 1);
  }
}
