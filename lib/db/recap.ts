import "server-only";

import {
  aggregateRange,
  aggregateRangeByGoal,
  buildCategoryBreakdown,
  type CategoryBreakdownRow,
} from "@/lib/aggregate";
import { categorizeEvents, fetchEventsRaw } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
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
  // The recap's headline: all tracked time this week (sessions + calendar
  // events) and its per-category split, incl. the Uncategorized bucket.
  totalTrackedMs: number;
  categoryRows: CategoryBreakdownRow[];
  // Goal-attributed session time — secondary to the category view.
  totalFocusedMs: number;
  goalRows: RecapGoalRow[];
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
// aggregateRangeByGoal with the caller's window so per-goal totals stay on
// the same week boundaries as the category numbers.
export async function computeWeekRecap(
  weekStartMs: number,
  weekEndMs: number
): Promise<WeekRecap> {
  // All four reads are independent (categorization happens in JS afterwards),
  // so they fire in one parallel wave; each is per-request cached.
  const [goals, categories, sessions, rawEvents] = await Promise.all([
    listActiveGoals(),
    listCategories(),
    listSessionsInRange(weekStartMs, weekEndMs),
    fetchEventsRaw(weekStartMs, weekEndMs),
  ]);
  const events = categorizeEvents(rawEvents, categories);

  // For past-week recaps cap aggregate's "now" at weekEnd so an active
  // session that started during the week (rare but possible) is counted up
  // to the end of that week, not artificially clipped. For current-week
  // recap, the real now lands within the week and acts normally.
  const aggregateNow = Math.min(Date.now(), weekEndMs);
  const { perGoal } = aggregateRangeByGoal(
    sessions,
    weekStartMs,
    weekEndMs,
    aggregateNow
  );

  // Category axis: clocked-in sessions + Google Calendar events (uncategorized
  // events land in the Uncategorized bucket). The complete time-spent view —
  // the recap leads with this.
  const { perCategory, total: totalTrackedMs } = aggregateRange(
    sessions,
    events,
    weekStartMs,
    weekEndMs,
    aggregateNow
  );
  const categoryRows = buildCategoryBreakdown(
    perCategory,
    categories,
    goals
  ).filter((r) => r.ms > 0);

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

  // Highlights — short plain language, never grades.
  const highlights: string[] = [];
  const hitGoals = goalRows.filter((g) => g.status === "hit");
  if (hitGoals.length === 1) {
    highlights.push(`Hit quota on ${hitGoals[0].title}.`);
  } else if (hitGoals.length > 1) {
    highlights.push(`Hit quota on ${hitGoals.length} goals.`);
  }

  return {
    weekStartMs,
    weekEndMs,
    totalTrackedMs,
    categoryRows,
    totalFocusedMs,
    goalRows,
    highlights,
  };
}
