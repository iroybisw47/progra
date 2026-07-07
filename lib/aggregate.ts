import { dayIndexMonFirst, endOfWeek, startOfWeek } from "@/lib/dates";
import type { DayEvent } from "@/lib/db/calendar-events";
import type { Goal } from "@/lib/db/goals";
import { sessionWorkedMs } from "@/lib/session";
import type { Category, Session } from "@/lib/storage";

// A goal-attributed session shows up in the category breakdowns as a synthetic
// "Goal: {name}" row, keyed by this prefix + the goal id (so it never collides
// with a real category id). One shared accent colour for all goal rows — the
// theme primary, so it adapts to the clock page's dark mode too.
const GOAL_KEY_PREFIX = "goal:";
export const GOAL_ACCENT = "var(--primary)";
export function goalCategoryKey(goalId: string): string {
  return GOAL_KEY_PREFIX + goalId;
}

export type CategoryBreakdownRow = {
  // null id = the Uncategorized bucket (clocked-in sessions with no category
  // and Google Calendar events that matched no category rule). A `goal:<id>`
  // id is a synthetic goal row (see GOAL_KEY_PREFIX).
  id: string | null;
  name: string;
  color: string | null;
  ms: number;
};

// Resolves a perCategory map into display rows: names/colors looked up from
// `categories`, the null bucket labelled "Uncategorized", `goal:<id>` keys
// labelled "Goal: {title}" in the goal accent, sorted descending by time.
// Shared by the home week card, the recap, and the /history rollups so the
// same category renders identically everywhere.
export function buildCategoryBreakdown(
  perCategory: Map<string | null, number>,
  categories: Category[],
  goals: Goal[] = []
): CategoryBreakdownRow[] {
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));
  const goalById = new Map(goals.map((g) => [g.id, g] as const));
  return Array.from(perCategory.entries())
    .map(([id, ms]) => {
      if (typeof id === "string" && id.startsWith(GOAL_KEY_PREFIX)) {
        const g = goalById.get(id.slice(GOAL_KEY_PREFIX.length));
        return { id, name: g ? `Goal: ${g.title}` : "Goal", color: GOAL_ACCENT, ms };
      }
      return {
        id,
        name:
          id === null ? "Uncategorized" : categoryById.get(id)?.name ?? "Uncategorized",
        color: id === null ? null : categoryById.get(id)?.color ?? null,
        ms,
      };
    })
    .sort((a, b) => b.ms - a.ms);
}

// One row in a category's audit breakdown — the individual session or calendar
// event that contributed time to the category in the window.
export type CategoryItem = {
  kind: "session" | "event";
  title: string;
  ms: number;
  startMs: number;
  // "session" = category clock-in; "goal" = goal clock-in; otherwise the
  // calendar event's provenance.
  source: "session" | "goal" | "manual" | "rule" | "ai" | "uncategorized";
};

// Per-category list of the exact items that make up its total, using the SAME
// attribution rules as aggregateRange (sessions by `endedAt`, events by
// `startMs`, same clipping and skip-if-non-positive), so each category's items
// sum to its bar. Keyed by category id; null = Uncategorized. Items are sorted
// by time descending (biggest contributors first). This is what powers the
// History "tap a category to see where the hours came from" breakdown.
export function buildCategoryItems(
  sessions: Session[],
  events: DayEvent[],
  rangeStart: number,
  rangeEnd: number,
  now: number
): Map<string | null, CategoryItem[]> {
  const byCat = new Map<string | null, CategoryItem[]>();
  const push = (cat: string | null, item: CategoryItem) => {
    const arr = byCat.get(cat);
    if (arr) arr.push(item);
    else byCat.set(cat, [item]);
  };

  for (const s of sessions) {
    const end = s.endedAt ?? now;
    const ms = sessionWorkedMs(s, now);
    if (ms <= 0) continue;
    if (end < rangeStart || end > rangeEnd) continue;
    push(s.goalId ? goalCategoryKey(s.goalId) : s.categoryId, {
      kind: "session",
      title: s.taskName.trim() || "Untitled session",
      ms,
      startMs: s.startedAt,
      source: s.goalId ? "goal" : "session",
    });
  }

  for (const e of events) {
    const ms = e.endMs - e.startMs;
    if (ms <= 0) continue;
    if (e.startMs < rangeStart || e.startMs > rangeEnd) continue;
    push(e.category?.id ?? null, {
      kind: "event",
      title: e.title?.trim() || "(no title)",
      ms,
      startMs: e.startMs,
      source: e.source,
    });
  }

  for (const arr of byCat.values()) arr.sort((a, b) => b.ms - a.ms);
  return byCat;
}

export type RangeTotals = {
  // null key = "Uncategorized"
  perCategory: Map<string | null, number>;
  total: number;
};

export type WeeklyTotals = RangeTotals & {
  // 7 entries, Monday-first
  perDay: number[];
};

// Per-category time-spent over an arbitrary [rangeStart, rangeEnd] window.
// Sessions are attributed to the instant of their `endedAt` (or `now` for
// active); events to the instant of their `startMs`. In-range iff that instant
// ∈ [rangeStart, rangeEnd]. Both sum without de-duplication — an event
// overlapping a session counts in both per the unified time-spent model.
// Uncategorized sessions and uncategorized calendar events both land under the
// null key. This is the single source of truth for category attribution; the
// weekly card and the month/year rollups both run through it, so they reconcile.
export function aggregateRange(
  sessions: Session[],
  events: DayEvent[],
  rangeStart: number,
  rangeEnd: number,
  now: number
): RangeTotals {
  const perCategory = new Map<string | null, number>();
  let total = 0;

  for (const s of sessions) {
    const end = s.endedAt ?? now;
    const ms = sessionWorkedMs(s, now);
    if (ms <= 0) continue;
    if (end < rangeStart || end > rangeEnd) continue;
    // Goal clock-ins bucket under a synthetic "goal:<id>" key so they render as
    // a "Goal: {name}" row; category clock-ins bucket under their category id.
    const key = s.goalId ? goalCategoryKey(s.goalId) : s.categoryId;
    perCategory.set(key, (perCategory.get(key) ?? 0) + ms);
    total += ms;
  }

  for (const e of events) {
    const ms = e.endMs - e.startMs;
    if (ms <= 0) continue;
    if (e.startMs < rangeStart || e.startMs > rangeEnd) continue;
    const catId = e.category?.id ?? null;
    perCategory.set(catId, (perCategory.get(catId) ?? 0) + ms);
    total += ms;
  }

  return { perCategory, total };
}

// Current-week category totals + a Mon-first per-day breakdown for the clock
// strip. Delegates per-category/total to aggregateRange so the week card and
// the rollups share identical attribution, then computes perDay on its own
// (day-of-week bucketing is week-specific and doesn't generalize to a month).
export function aggregateWeek(
  sessions: Session[],
  events: DayEvent[],
  now: number
): WeeklyTotals {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  const { perCategory, total } = aggregateRange(
    sessions,
    events,
    weekStart,
    weekEnd,
    now
  );

  const perDay = [0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions) {
    const end = s.endedAt ?? now;
    const ms = sessionWorkedMs(s, now);
    if (ms <= 0) continue;
    if (end < weekStart || end > weekEnd) continue;
    perDay[dayIndexMonFirst(new Date(end))] += ms;
  }
  for (const e of events) {
    const ms = e.endMs - e.startMs;
    if (ms <= 0) continue;
    if (e.startMs < weekStart || e.startMs > weekEnd) continue;
    perDay[dayIndexMonFirst(new Date(e.startMs))] += ms;
  }

  return { perCategory, perDay, total };
}

export type WeeklyGoalTotals = {
  // goalId → ms, attributed directly via session.goalId
  perGoal: Map<string, number>;
  // ms for in-window sessions with no goal (i.e. category clock-ins) — that
  // time lives on the category axis, not "untracked goal time" per se.
  untracked: number;
  total: number;
};

// Per-goal session summing over an arbitrary [rangeStart, rangeEnd] window.
// Session attribution mirrors aggregateWeek exactly: `end = endedAt ?? now`,
// in-range iff end ∈ [rangeStart, rangeEnd], skip non-positive durations. A
// session links straight to its goal via `goalId` (no plan indirection); the
// per-session ms contribution to its goal equals its contribution to the
// matching "Goal: {name}" row in aggregateRange — that invariant keeps the
// goal bars and category bars consistent, and makes week / month / year
// rollups reconcile (they are this same function over wider windows).
export function aggregateRangeByGoal(
  sessions: Session[],
  rangeStart: number,
  rangeEnd: number,
  now: number
): WeeklyGoalTotals {
  const perGoal = new Map<string, number>();
  let untracked = 0;

  for (const s of sessions) {
    const end = s.endedAt ?? now;
    const ms = sessionWorkedMs(s, now);
    if (ms <= 0) continue;
    if (end < rangeStart || end > rangeEnd) continue;
    if (s.goalId === null) {
      untracked += ms;
    } else {
      perGoal.set(s.goalId, (perGoal.get(s.goalId) ?? 0) + ms);
    }
  }

  let total = untracked;
  for (const v of perGoal.values()) total += v;
  return { perGoal, untracked, total };
}

// Current-week convenience wrapper — derives the Mon–Sun window from `now`
// and delegates to aggregateRangeByGoal so the weekly numbers and the
// month/year rollups run through identical session-summing logic.
export function aggregateWeekByGoal(
  sessions: Session[],
  now: number
): WeeklyGoalTotals {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  return aggregateRangeByGoal(sessions, weekStart, weekEnd, now);
}
