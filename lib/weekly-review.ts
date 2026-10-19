import { isoDateInTimeZone, mondayOfDateISO, reviewReadyMs, weekWindow } from "@/lib/dates";
import { GOAL_KEY_PREFIX } from "@/lib/aggregate";
import { entityColor } from "@/lib/colors";
import { UNCATEGORIZED_FILL, type ReviewPostSummary } from "@/lib/recap-story";

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
  categories: PostSlice[];
};

// ---- The post's wheel -------------------------------------------------------

// One slice of a posted week's wheel, stored in recap_posts.categories (jsonb,
// so no migration). `color` is the resolved fill. Posts from before
// 2026-10-18 hold the raw top four rows instead: a category's own color, null
// for Uncategorized, a private goal's title unmasked. postWheel reads both.
export type PostSlice = { name: string; color: string | null; ms: number };

// The breakdown row the week's recap computes (lib/aggregate.ts).
type BreakdownRow = { id: string | null; name: string; color: string | null; isGoal: boolean; ms: number };

// lib/aggregate.ts buildCategoryBreakdown names a goal's row "Goal: {title}".
const GOAL_PREFIX = "Goal: ";

export const OTHER_FILL = "#dfe3e8";
// Slices stored, "Other" and Uncategorized included. Enough to read at a
// glance on a feed card; the rest folds into "Other" so the wheel still sums
// to the week.
export const POST_SLICE_MAX = 6;

// What a post's wheel stores, by the rules of the story's "Where it went"
// slide (lib/recap-story.ts whereSlide): time only, a since-deleted category
// counted as Uncategorized, the rest largest first, Uncategorized last. Two
// rules of its own, because friends see this and the slide is the owner's:
//   - a private goal is never named. All of them become one "Private goals"
//     slice, in the color of the largest;
//   - past POST_SLICE_MAX, the smallest named slices fold into "Other".
// A goal that isn't private is stored under its own title, without the
// breakdown's "Goal: " prefix. That prefix is what marks an old post's goal
// rows, which postWheel can't tell private from public and so hides.
export function postSlices(
  rows: readonly BreakdownRow[],
  privateGoalIds: ReadonlySet<string>,
  liveCategoryIds: ReadonlySet<string>
): PostSlice[] {
  let looseMs = 0;
  let privateMs = 0;
  let privateColor: string | null = null;
  let privateTop = 0;
  const named: PostSlice[] = [];
  for (const r of rows) {
    if (r.ms <= 0) continue;
    if (r.isGoal && r.id && privateGoalIds.has(r.id.slice(GOAL_KEY_PREFIX.length))) {
      privateMs += r.ms;
      if (r.ms > privateTop) {
        privateTop = r.ms;
        privateColor = entityColor(r.color);
      }
    } else if (r.id === null || (!r.isGoal && !liveCategoryIds.has(r.id))) {
      looseMs += r.ms;
    } else {
      const name = r.isGoal && r.name.startsWith(GOAL_PREFIX) ? r.name.slice(GOAL_PREFIX.length) : r.name;
      named.push({ name, color: entityColor(r.color), ms: r.ms });
    }
  }
  if (privateMs > 0) named.push({ name: "Private goals", color: privateColor, ms: privateMs });
  named.sort((a, b) => b.ms - a.ms);

  const room = POST_SLICE_MAX - (looseMs > 0 ? 1 : 0);
  const kept =
    named.length <= room
      ? named
      : [
          ...named.slice(0, room - 1),
          {
            name: "Other",
            color: OTHER_FILL,
            ms: named.slice(room - 1).reduce((s, x) => s + x.ms, 0),
          },
        ];
  return looseMs > 0
    ? [...kept, { name: "Uncategorized", color: UNCATEGORIZED_FILL, ms: looseMs }]
    : kept;
}

// A post's wheel as drawn: segments in fill colors, and the legend's rows.
// Reads new posts and old ones alike. An old post's null color is its
// Uncategorized row, and its goal rows ("Goal: <title>", stored before
// private goals were masked) show as plain "Goal", since nothing says
// whether they were private. Null when there's no time to draw.
export function postWheel(
  slices: readonly PostSlice[] | null | undefined
): { segments: { color: string; value: number }[]; rows: { name: string; color: string; ms: number }[] } | null {
  const rows = (slices ?? [])
    .filter((s) => s && typeof s.ms === "number" && s.ms > 0)
    .map((s) => ({
      name: s.color === null ? "Uncategorized" : s.name.startsWith(GOAL_PREFIX) ? "Goal" : s.name,
      color: s.color === null ? UNCATEGORIZED_FILL : entityColor(s.color),
      ms: s.ms,
    }));
  if (rows.length === 0) return null;
  return { segments: rows.map((r) => ({ color: r.color, value: r.ms })), rows };
}

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
