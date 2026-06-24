import "server-only";

import {
  aggregateRange,
  aggregateRangeByGoal,
  buildCategoryBreakdown,
  type CategoryBreakdownRow,
} from "@/lib/aggregate";
import {
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
} from "@/lib/dates";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { listPlansForGoals } from "@/lib/db/session-plans";
import { listSessionsInRange } from "@/lib/db/sessions";

export type RollupGoalRow = {
  id: string;
  title: string;
  actualMs: number;
};

export type Rollup = {
  startMs: number;
  endMs: number;
  // Total tracked time = clocked-in sessions + Google Calendar events, summed
  // across all categories (including Uncategorized). This is the headline
  // "where your time went" number for the period.
  totalTrackedMs: number;
  // Time per category, descending. Includes the Uncategorized bucket (no-
  // category sessions + calendar events that matched no rule). Reconciles with
  // the home week card and the weekly recap's category breakdown.
  categoryRows: CategoryBreakdownRow[];
  // Sum of per-goal hours (sessions attributed to an active goal). Mirrors the
  // weekly recap's `totalFocusedMs` definition so summing the weekly recaps
  // inside this window reconciles with this number. Subset of totalTrackedMs.
  totalFocusedMs: number;
  // Sessions in-window not tied to an active goal (no plan, or a plan whose
  // goal is archived). Surfaced separately, never folded into "focused".
  untrackedMs: number;
  // Goals with time in the window, descending. Goals with 0h are omitted —
  // over a month or year, listing every untouched goal is noise, not signal.
  goalRows: RollupGoalRow[];
  // Sessions whose end falls within the window.
  sessionsCompleted: number;
};

// Read-only aggregation over an arbitrary calendar window. Reuses the exact
// reads the weekly recap/home dashboard use (active goals, their plans, the
// sessions overlapping the window) and the shared aggregateRangeByGoal summing
// logic, so per-goal totals are consistent across week/month/year.
//
// We fetch only the window's sessions (not every session ever) and aggregate
// them in JS rather than in SQL. That's a deliberate trade-off: the in-JS rule
// — attribute a session's full duration to the local-time bucket of its `end`,
// counting an active session up to the window end — is what guarantees the
// numbers reconcile with the weekly recap, and it's hard to replicate exactly
// in PostgREST. For a single user a month/year of sessions is a small set.
async function computeRollup(startMs: number, endMs: number): Promise<Rollup> {
  const goals = await listActiveGoals();
  const plans =
    goals.length > 0 ? await listPlansForGoals(goals.map((g) => g.id)) : [];
  const categories = await listCategories();
  const sessions = await listSessionsInRange(startMs, endMs);
  // Categorized calendar events overlapping the window. Excluded events are
  // already filtered out by listEventsInRange; uncategorized ones flow into the
  // null bucket via aggregateRange. (Future: parse a category from the event
  // title with Claude instead of leaving title-only events Uncategorized.)
  const events = await listEventsInRange(startMs, endMs, categories);

  // For past windows, cap aggregate's "now" at the window end so a session
  // still running into the window counts up to the end, not artificially
  // clipped — same treatment the weekly recap applies.
  const aggregateNow = Math.min(Date.now(), endMs);

  // Category axis: sessions + calendar events, the complete time-spent view.
  const { perCategory, total: totalTrackedMs } = aggregateRange(
    sessions,
    events,
    startMs,
    endMs,
    aggregateNow
  );
  const categoryRows = buildCategoryBreakdown(perCategory, categories).filter(
    (r) => r.ms > 0
  );

  // Goal axis: sessions attributed to an active goal (subset of the above).
  const planToGoal = new Map(plans.map((p) => [p.id, p.goalId] as const));
  const { perGoal, untracked } = aggregateRangeByGoal(
    sessions,
    planToGoal,
    startMs,
    endMs,
    aggregateNow
  );

  const goalRows: RollupGoalRow[] = goals
    .map((g) => ({ id: g.id, title: g.title, actualMs: perGoal.get(g.id) ?? 0 }))
    .filter((r) => r.actualMs > 0)
    .sort((a, b) => b.actualMs - a.actualMs);

  const totalFocusedMs = goalRows.reduce((s, r) => s + r.actualMs, 0);

  const sessionsCompleted = sessions.filter(
    (s) => s.endedAt !== null && s.endedAt >= startMs && s.endedAt <= endMs
  ).length;

  return {
    startMs,
    endMs,
    totalTrackedMs,
    categoryRows,
    totalFocusedMs,
    untrackedMs: untracked,
    goalRows,
    sessionsCompleted,
  };
}

// Time-per-goal summed over the calendar month containing `anchor`.
export async function computeMonthRollup(anchor: Date): Promise<Rollup> {
  return computeRollup(
    startOfMonth(anchor).getTime(),
    endOfMonth(anchor).getTime()
  );
}

// Time-per-goal summed over the calendar year containing `anchor`.
export async function computeYearRollup(anchor: Date): Promise<Rollup> {
  return computeRollup(
    startOfYear(anchor).getTime(),
    endOfYear(anchor).getTime()
  );
}
