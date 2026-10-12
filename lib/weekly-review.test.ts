import { describe, expect, it } from "vitest";

import { weekWindow } from "@/lib/dates";
import { buildRecapStory, habitWeekPct, reviewPostSummary } from "@/lib/recap-story";
import { recapPreviewInput } from "@/lib/recap-story-preview";
import {
  CAPTION_MAX,
  isReviewPostable,
  normalizeCaption,
  reviewPostRow,
  reviewStats,
  reviewStatsLine,
  reviewWeekISO,
} from "@/lib/weekly-review";

const H = 60 * 60 * 1000;

describe("normalizeCaption", () => {
  it("trims, folds whitespace, empty → null", () => {
    expect(normalizeCaption("  Big week.\n\nShipped it  ")).toEqual({ caption: "Big week. Shipped it" });
    expect(normalizeCaption("   ")).toEqual({ caption: null });
    expect(normalizeCaption(undefined)).toEqual({ caption: null });
  });
  it("refuses rather than cuts past the limit", () => {
    expect(normalizeCaption("a".repeat(CAPTION_MAX))).toEqual({ caption: "a".repeat(CAPTION_MAX) });
    expect(normalizeCaption("a".repeat(CAPTION_MAX + 1))).toHaveProperty("error");
    expect(normalizeCaption(42)).toHaveProperty("error");
  });
});

describe("habitWeekPct", () => {
  it("is every tick over every habit-day, exactly", () => {
    expect(habitWeekPct([])).toBeNull();
    expect(habitWeekPct([{ days: Array(7).fill(true) }, { days: Array(7).fill(false) }])).toBe(50);
    expect(
      habitWeekPct([
        { days: [true, false, false, false, false, false, false] },
        { days: Array(7).fill(false) },
        { days: Array(7).fill(false) },
      ])
    ).toBe(5);
  });
});

describe("reviewPostSummary", () => {
  it("agrees with the story the person just watched", () => {
    const input = recapPreviewInput("above");
    const story = buildRecapStory(input);
    const s = reviewPostSummary(input);
    expect(s.goalPct).toBe(story.goals?.pct);
    expect(s.goalCount).toBe(3);
    expect(s.habitCount).toBe(4);
    // 6 + 5 + 4 + 3 ticks over 28 habit-days.
    expect(s.habitPct).toBe(64);
    expect(s.totalTrackedMs).toBe(11.5 * H);
  });
  it("leaves out what the week didn't have", () => {
    const s = reviewPostSummary({ ...recapPreviewInput("above"), goals: [], habits: [], completions: [] });
    expect(s).toMatchObject({ goalPct: null, goalCount: 0, habitPct: null, habitCount: 0 });
  });
});

describe("isReviewPostable", () => {
  const LA = "America/Los_Angeles";
  it("once the review is out, for a week the account existed in", () => {
    expect(isReviewPostable("2026-10-05", LA, Date.UTC(2026, 9, 12, 12, 59), 0)).toBe(false);
    expect(isReviewPostable("2026-10-05", LA, Date.UTC(2026, 9, 12, 13), 0)).toBe(true);
    // Signed up Monday morning PDT: the week ended before the account existed.
    expect(isReviewPostable("2026-10-05", LA, Date.UTC(2026, 9, 20), Date.UTC(2026, 9, 12, 8))).toBe(false);
  });
});

describe("reviewWeekISO", () => {
  it("finds the Monday from week_start_ms whatever the author's zone", () => {
    for (const tz of [
      "America/Los_Angeles",
      "America/New_York",
      "Asia/Kolkata",
      "Pacific/Chatham",
      "Pacific/Kiritimati",
      "Pacific/Pago_Pago",
      "UTC",
    ]) {
      for (const week of ["2026-10-05", "2026-03-02", "2026-10-26", "2026-12-28"]) {
        expect(reviewWeekISO(weekWindow(tz, week).weekStartMs)).toBe(week);
      }
    }
  });
});

describe("reviewPostRow", () => {
  it("writes the stats and never created_at", () => {
    const row = reviewPostRow(
      { totalTrackedMs: 11.5 * H, goalPct: 86, goalCount: 3, habitPct: 64, habitCount: 4 },
      { rank: 2, circleSize: 8, categories: [{ name: "Thesis", color: "#E07042", ms: 5 * H }] },
      "u1",
      123,
      "Big week"
    );
    expect(row).toEqual({
      user_id: "u1",
      week_start_ms: 123,
      caption: "Big week",
      total_tracked_ms: 11.5 * H,
      goal_pct: 86,
      goal_count: 3,
      habit_pct: 64,
      habit_count: 4,
      rank: 2,
      circle_size: 8,
      categories: [{ name: "Thesis", color: "#E07042", ms: 5 * H }],
    });
    expect(row).not.toHaveProperty("created_at");
  });
});

describe("reviewStats", () => {
  it("hours always; goals and habits when the week had them", () => {
    expect(
      reviewStats({ totalTrackedMs: 11.5 * H, goalPct: 86, goalCount: 3, habitPct: 64, habitCount: 4 })
    ).toEqual([
      { key: "hours", value: "11.5", unit: "hrs", label: "tracked" },
      { key: "goals", value: "86", unit: "%", label: "of 3 goals" },
      { key: "habits", value: "64", unit: "%", label: "of 4 habits" },
    ]);
    expect(
      reviewStats({ totalTrackedMs: H, goalPct: 40, goalCount: 1, habitPct: 100, habitCount: 1 }).map((s) => s.label)
    ).toEqual(["tracked", "of weekly goal", "habit done"]);
    // An old-story post stored no counts: hours only.
    expect(
      reviewStats({ totalTrackedMs: 3 * H, goalPct: null, goalCount: null, habitPct: null, habitCount: null })
    ).toHaveLength(1);
  });
});

describe("reviewStatsLine", () => {
  it("one line for a compact row", () => {
    expect(
      reviewStatsLine(
        reviewStats({ totalTrackedMs: 11.5 * H, goalPct: 86, goalCount: 3, habitPct: 64, habitCount: 4 })
      )
    ).toBe("11.5 hrs · 86% goals · 64% habits");
    expect(
      reviewStatsLine(reviewStats({ totalTrackedMs: 2 * H, goalPct: null, goalCount: null, habitPct: null, habitCount: null }))
    ).toBe("2.0 hrs");
  });
});
