import "server-only";

import {
  aggregateRange,
  aggregateWeekByGoal,
  buildCategoryBreakdown,
  type CategoryBreakdownRow,
} from "@/lib/aggregate";
import { formatLocalDate } from "@/lib/dates";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { listActiveHabits, listCompletionsInRange } from "@/lib/db/habits";
import { listBlocksInRange } from "@/lib/db/scheduled-blocks";
import { listPlansForGoals } from "@/lib/db/session-plans";
import { listSessionsInRange } from "@/lib/db/sessions";

const HOUR_MS = 60 * 60 * 1000;
// "Close to quota" floor — soft framing, not a grade.
const CLOSE_RATIO = 0.75;

export type GoalRecapStatus = "hit" | "close" | "under";

export type RecapGoalRow = {
  id: string;
  title: string;
  quotaHours: number;
  actualMs: number;
  status: GoalRecapStatus;
};

export type WeekRecap = {
  weekStartMs: number;
  weekEndMs: number;
  totalFocusedMs: number;
  goalRows: RecapGoalRow[];
  // All tracked time this week (sessions + calendar events) and its per-
  // category split, incl. the Uncategorized bucket. Superset of totalFocusedMs.
  totalTrackedMs: number;
  categoryRows: CategoryBreakdownRow[];
  sessionsCompleted: number;
  habitChecks: number;
  activeHabitsCount: number;
  blocksDone: number;
  blocksMissed: number;
  blocksMoved: number;
  blocksScheduled: number;
  highlights: string[];
};

function statusForGoal(actualMs: number, quotaHours: number): GoalRecapStatus {
  const quotaMs = quotaHours * HOUR_MS;
  if (quotaMs <= 0) return "under";
  if (actualMs >= quotaMs) return "hit";
  if (actualMs >= CLOSE_RATIO * quotaMs) return "close";
  return "under";
}

// Pure aggregation over data the rest of the app already produces. Reuses
// aggregateWeekByGoal so per-goal totals match /goals and the home dashboard
// exactly for the same week.
export async function computeWeekRecap(
  weekStartMs: number,
  weekEndMs: number
): Promise<WeekRecap> {
  const goals = await listActiveGoals();
  const plans =
    goals.length > 0
      ? await listPlansForGoals(goals.map((g) => g.id))
      : [];
  const categories = await listCategories();

  const startLocalDate = formatLocalDate(new Date(weekStartMs));
  const endLocalDate = formatLocalDate(new Date(weekEndMs));

  const [sessions, events, blocks, completions, habits] = await Promise.all([
    listSessionsInRange(weekStartMs, weekEndMs),
    listEventsInRange(weekStartMs, weekEndMs, categories),
    listBlocksInRange(weekStartMs, weekEndMs),
    listCompletionsInRange(startLocalDate, endLocalDate),
    listActiveHabits(),
  ]);

  // For past-week recaps cap aggregate's "now" at weekEnd so an active
  // session that started during the week (rare but possible) is counted up
  // to the end of that week, not artificially clipped. For current-week
  // recap, the real now lands within the week and acts normally.
  const aggregateNow = Math.min(Date.now(), weekEndMs);
  const planToGoal = new Map(plans.map((p) => [p.id, p.goalId] as const));
  const { perGoal } = aggregateWeekByGoal(sessions, planToGoal, aggregateNow);

  // Category axis: clocked-in sessions + Google Calendar events (uncategorized
  // events land in the Uncategorized bucket). The complete time-spent view,
  // alongside the goal-focused numbers below.
  const { perCategory, total: totalTrackedMs } = aggregateRange(
    sessions,
    events,
    weekStartMs,
    weekEndMs,
    aggregateNow
  );
  const categoryRows = buildCategoryBreakdown(perCategory, categories).filter(
    (r) => r.ms > 0
  );

  const goalRows: RecapGoalRow[] = goals
    .map((g) => {
      const actualMs = perGoal.get(g.id) ?? 0;
      return {
        id: g.id,
        title: g.title,
        quotaHours: g.weeklyQuotaHours,
        actualMs,
        status: statusForGoal(actualMs, g.weeklyQuotaHours),
      };
    })
    .sort((a, b) => b.actualMs - a.actualMs);

  // Total focused hours = sum of per-goal hours (sessions-only). Sessions
  // unattributed to a goal stay outside this number — keeps "focused" =
  // "I clocked in deliberately on something I planned".
  const totalFocusedMs = goalRows.reduce((s, g) => s + g.actualMs, 0);

  // Sessions that ended within the week. Active sessions don't count.
  const sessionsCompleted = sessions.filter(
    (s) =>
      s.endedAt !== null && s.endedAt >= weekStartMs && s.endedAt <= weekEndMs
  ).length;

  // Habit checks = number of completion rows in the week. No denominator —
  // showing "X of Y" mid-week mostly reads as judgment.
  const habitChecks = completions.length;
  const activeHabitsCount = habits.length;

  let blocksDone = 0;
  let blocksMissed = 0;
  let blocksMoved = 0;
  let blocksScheduled = 0;
  for (const b of blocks) {
    if (b.status === "done") blocksDone++;
    else if (b.status === "missed") blocksMissed++;
    else if (b.status === "moved") blocksMoved++;
    else blocksScheduled++;
  }

  // Highlights — short plain language, never grades.
  const highlights: string[] = [];
  const top = goalRows.find((g) => g.actualMs > 0);
  if (top) {
    highlights.push(
      `Most time on ${top.title} (${(top.actualMs / HOUR_MS).toFixed(1)}h).`
    );
  }
  const hitGoals = goalRows.filter((g) => g.status === "hit");
  if (hitGoals.length === 1) {
    highlights.push(`Hit quota on ${hitGoals[0].title}.`);
  } else if (hitGoals.length > 1) {
    highlights.push(`Hit quota on ${hitGoals.length} goals.`);
  }

  return {
    weekStartMs,
    weekEndMs,
    totalFocusedMs,
    goalRows,
    totalTrackedMs,
    categoryRows,
    sessionsCompleted,
    habitChecks,
    activeHabitsCount,
    blocksDone,
    blocksMissed,
    blocksMoved,
    blocksScheduled,
    highlights,
  };
}
