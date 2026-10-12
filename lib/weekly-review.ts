import { isoDateInTimeZone, mondayOfDateISO, reviewReadyMs, weekWindow } from "@/lib/dates";
import type { ReviewPostSummary } from "@/lib/recap-story";

// A POSTED weekly review (RECAP_V2's Share slide → recap_posts): the rules
// for what gets written and how a post reads back. Pure and client-safe; the
// story's own numbers come from lib/recap-story.ts (reviewPostSummary).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// The caption's limit — also the column's CHECK (.claude/plans/recap-v2.sql).
export const CAPTION_MAX = 280;

// One line of text: trimmed, inner runs of whitespace (newlines too) folded to
// one space, empty → null. Too long is refused rather than cut, so what was
// posted is what was typed.
export function normalizeCaption(
  raw: unknown
): { caption: string | null } | { error: string } {
  if (raw !== null && raw !== undefined && typeof raw !== "string") return { error: "Invalid caption." };
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (text.length > CAPTION_MAX) return { error: `Captions are ${CAPTION_MAX} characters at most.` };
  return { caption: text.length ? text : null };
}

// Whether a week can be posted now: its review is out (Monday 06:00 after it,
// local) and the account existed by its end — the same week the story opens on.
export function isReviewPostable(
  weekStartISO: string,
  tz: string,
  nowMs: number,
  createdMs: number
): boolean {
  if (nowMs < reviewReadyMs(weekStartISO, tz)) return false;
  return weekWindow(tz, weekStartISO).weekEndMs >= createdMs;
}

// The Monday (YYYY-MM-DD) a post's week_start_ms belongs to, without knowing
// the author's timezone: a Monday-00:00 instant in any zone (UTC−12…+14) plus
// three and a half days is Wednesday–Friday in UTC, inside the same week.
export function reviewWeekISO(weekStartMs: number): string {
  return mondayOfDateISO(isoDateInTimeZone(weekStartMs + 3.5 * DAY_MS, "UTC"));
}

export type ReviewPostExtras = {
  rank: number | null;
  circleSize: number;
  categories: { name: string; color: string | null; ms: number }[];
};

// The recap_posts row a post writes. created_at is deliberately absent: a
// re-post (a caption edit) keeps the original, so it doesn't jump up the feed.
export function reviewPostRow(
  summary: ReviewPostSummary,
  extras: ReviewPostExtras,
  userId: string,
  weekStartMs: number,
  caption: string | null
) {
  return {
    user_id: userId,
    week_start_ms: weekStartMs,
    caption,
    total_tracked_ms: Math.round(summary.totalTrackedMs),
    goal_pct: summary.goalPct,
    goal_count: summary.goalCount,
    habit_pct: summary.habitPct,
    habit_count: summary.habitCount,
    rank: extras.rank,
    circle_size: extras.circleSize,
    categories: extras.categories,
  };
}

export type ReviewStat = {
  key: "hours" | "goals" | "habits";
  value: string;
  unit: string;
  label: string;
};

// What a post shows, in order: hours always; goals and habits when the week
// had them. A post from the old story (no counts stored) shows hours only.
export function reviewStats(p: {
  totalTrackedMs: number;
  goalPct: number | null;
  goalCount: number | null;
  habitPct: number | null;
  habitCount: number | null;
}): ReviewStat[] {
  const stats: ReviewStat[] = [
    { key: "hours", value: (p.totalTrackedMs / HOUR_MS).toFixed(1), unit: "hrs", label: "tracked" },
  ];
  if (p.goalPct !== null && p.goalCount) {
    stats.push({
      key: "goals",
      value: String(p.goalPct),
      unit: "%",
      label: p.goalCount === 1 ? "of weekly goal" : `of ${p.goalCount} goals`,
    });
  }
  if (p.habitPct !== null && p.habitCount) {
    stats.push({
      key: "habits",
      value: String(p.habitPct),
      unit: "%",
      label: p.habitCount === 1 ? "habit done" : `of ${p.habitCount} habits`,
    });
  }
  return stats;
}

// The same stats on one line, for the compact rows on You and profiles:
// "11.5 hrs · 86% goals · 64% habits".
export function reviewStatsLine(stats: ReviewStat[]): string {
  return stats
    .map((s) => (s.key === "hours" ? `${s.value} hrs` : `${s.value}% ${s.key}`))
    .join(" · ");
}
