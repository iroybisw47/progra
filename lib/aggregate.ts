import { dayIndexMonFirst, endOfWeek, startOfWeek } from "@/lib/dates";
import type { DayEvent } from "@/lib/db/calendar-events";
import type { Session } from "@/lib/storage";

export type WeeklyTotals = {
  // null key = "Uncategorized"
  perCategory: Map<string | null, number>;
  // 7 entries, Monday-first
  perDay: number[];
  total: number;
};

// Sessions are attributed to the local-day of their `endedAt` (or `now` for
// active). Events are attributed to the local-day of their `startMs`. Both
// sum without de-duplication — an event overlapping a session counts in
// both totals per the unified time-spent model.
export function aggregateWeek(
  sessions: Session[],
  events: DayEvent[],
  now: number
): WeeklyTotals {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  const perCategory = new Map<string | null, number>();
  const perDay = [0, 0, 0, 0, 0, 0, 0];

  for (const s of sessions) {
    const end = s.endedAt ?? now;
    const ms = end - s.startedAt;
    if (ms <= 0) continue;
    if (end < weekStart || end > weekEnd) continue;
    perDay[dayIndexMonFirst(new Date(end))] += ms;
    perCategory.set(s.categoryId, (perCategory.get(s.categoryId) ?? 0) + ms);
  }

  for (const e of events) {
    const ms = e.endMs - e.startMs;
    if (ms <= 0) continue;
    if (e.startMs < weekStart || e.startMs > weekEnd) continue;
    perDay[dayIndexMonFirst(new Date(e.startMs))] += ms;
    const catId = e.category?.id ?? null;
    perCategory.set(catId, (perCategory.get(catId) ?? 0) + ms);
  }

  return { perCategory, perDay, total: perDay.reduce((x, y) => x + y, 0) };
}

export type WeeklyGoalTotals = {
  // goalId → ms attributed via session_plan_id → plan → goal
  perGoal: Map<string, number>;
  // ms for sessions in-week whose plan isn't in `planToGoal` (no plan, or
  // attached to a plan whose goal isn't tracked here — e.g. archived).
  untracked: number;
  total: number;
};

// Mirrors aggregateWeek's session attribution exactly: `end = endedAt ?? now`,
// in-week iff end ∈ [weekStart, weekEnd], skip non-positive durations. The
// per-session ms contribution to its goal equals its contribution to its
// category in aggregateWeek — that invariant is what keeps the goal bars
// and category bars consistent for the same sessions.
export function aggregateWeekByGoal(
  sessions: Session[],
  planToGoal: Map<string, string>,
  now: number
): WeeklyGoalTotals {
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  const perGoal = new Map<string, number>();
  let untracked = 0;

  for (const s of sessions) {
    const end = s.endedAt ?? now;
    const ms = end - s.startedAt;
    if (ms <= 0) continue;
    if (end < weekStart || end > weekEnd) continue;
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
