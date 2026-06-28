import { dayIndexMonFirst, endOfWeek, startOfWeek } from "@/lib/dates";
import type { DayEvent } from "@/lib/db/calendar-events";
import { sessionWorkedMs } from "@/lib/session";
import type { Category, Session } from "@/lib/storage";

export type CategoryBreakdownRow = {
  // null id = the Uncategorized bucket (clocked-in sessions with no category
  // and Google Calendar events that matched no category rule).
  id: string | null;
  name: string;
  color: string | null;
  ms: number;
};

// Resolves a perCategory map into display rows: names/colors looked up from
// `categories`, the null bucket labelled "Uncategorized", sorted descending by
// time. Shared by the home week card, the recap, and the /history rollups so
// the same category renders identically everywhere.
export function buildCategoryBreakdown(
  perCategory: Map<string | null, number>,
  categories: Category[]
): CategoryBreakdownRow[] {
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));
  return Array.from(perCategory.entries())
    .map(([id, ms]) => ({
      id,
      name:
        id === null ? "Uncategorized" : categoryById.get(id)?.name ?? "Uncategorized",
      color: id === null ? null : categoryById.get(id)?.color ?? null,
      ms,
    }))
    .sort((a, b) => b.ms - a.ms);
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
    perCategory.set(s.categoryId, (perCategory.get(s.categoryId) ?? 0) + ms);
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
  // goalId → ms attributed via session_plan_id → plan → goal
  perGoal: Map<string, number>;
  // ms for sessions in-week whose plan isn't in `planToGoal` (no plan, or
  // attached to a plan whose goal isn't tracked here — e.g. archived).
  untracked: number;
  total: number;
};

// Per-goal session summing over an arbitrary [rangeStart, rangeEnd] window.
// Session attribution mirrors aggregateWeek exactly: `end = endedAt ?? now`,
// in-range iff end ∈ [rangeStart, rangeEnd], skip non-positive durations. The
// per-session ms contribution to its goal equals its contribution to its
// category in aggregateWeek — that invariant is what keeps the goal bars and
// category bars consistent for the same sessions, and what makes week / month
// / year rollups reconcile (they are this same function over wider windows).
export function aggregateRangeByGoal(
  sessions: Session[],
  planToGoal: Map<string, string>,
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
    const goalId = s.sessionPlanId
      ? planToGoal.get(s.sessionPlanId) ?? null
      : null;
    if (goalId === null) {
      untracked += ms;
    } else {
      perGoal.set(goalId, (perGoal.get(goalId) ?? 0) + ms);
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
  planToGoal: Map<string, string>,
  now: number
): WeeklyGoalTotals {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  return aggregateRangeByGoal(sessions, planToGoal, weekStart, weekEnd, now);
}
