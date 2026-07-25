import "server-only";

import { aggregateRange, buildCategoryBreakdown } from "@/lib/aggregate";
import { categorizeEvents, fetchEventsRaw } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { hydrateGoalTitles } from "@/lib/db/feed";
import { listActiveGoals } from "@/lib/db/goals";
import {
  getHabitsWithTodayStatus,
  listActiveHabits,
  listCompletionsInRange,
} from "@/lib/db/habits";
import { computeWeekRecap } from "@/lib/db/recap";
import { listSessionsInRange } from "@/lib/db/sessions";
import { getProfile } from "@/lib/auth/profile";
import {
  addDaysISO,
  mondayOfDateISO,
  todayInTimeZone,
  zonedDayStartMs,
} from "@/lib/dates";
import { sessionWorkedMs } from "@/lib/session";
import type {
  GoalRow,
  HabitToday,
  Seg,
  SessionToday,
} from "@/components/v2/progress-client";

const CHART_FALLBACK = "var(--chart-5)";

export type ProgressData = {
  dateLabel: string;
  todayTotalMs: number;
  todayTracked: number;
  todayImported: number;
  todaySegs: Seg[];
  sessionsToday: SessionToday[];
  goals: GoalRow[];
  habitsToday: HabitToday[];
  weekTotalMs: number;
  weekSegs: Seg[];
  weekRangeLabel: string;
  weekTracked: number;
  weekImported: number;
  weekStart: string;
  today: string;
};

// The Monday (YYYY-MM-DD) of the current week in `tz`. Single source for the
// week-start computation so page-level callers (which parallelize
// loadProgressData with loadWeekHabits) stay on the same boundary as the
// progress data itself.
export function currentWeekStart(tz: string): string {
  return mondayOfDateISO(todayInTimeZone(tz));
}

// Composes everything the Progress tab (Today / This week / History) needs in a
// single server read. Windows are computed in the user's stored timezone so the
// day/week/month boundaries match the rest of the app. Reuses the shared
// aggregation engine — this is a composition layer, not new attribution logic.
export async function loadProgressData(): Promise<ProgressData> {
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const now = Date.now();

  const today = todayInTimeZone(tz);
  const monday = mondayOfDateISO(today);

  const dayStartMs = zonedDayStartMs(today, tz);
  const dayEndMs = zonedDayStartMs(addDaysISO(today, 1), tz) - 1;
  const weekStartMs = zonedDayStartMs(monday, tz);
  const weekEndMs = zonedDayStartMs(addDaysISO(monday, 7), tz) - 1;

  // One parallel wave for every read this page needs (the day-window event
  // fetch categorizes in JS afterwards, so it no longer waits on categories).
  const [
    categories,
    weekRecap,
    habitsStatus,
    daySessions,
    rawDayEvents,
    activeGoals,
  ] = await Promise.all([
    listCategories(),
    computeWeekRecap(weekStartMs, weekEndMs),
    getHabitsWithTodayStatus(today),
    listSessionsInRange(dayStartMs, dayEndMs),
    fetchEventsRaw(dayStartMs, dayEndMs),
    listActiveGoals(),
  ]);

  // --- Today window ---
  const dayEvents = categorizeEvents(rawDayEvents, categories);
  const dayNow = Math.min(now, dayEndMs);
  const { total: todayTotalMs, perCategory: todayPerCategory } = aggregateRange(
    daySessions,
    dayEvents,
    dayStartMs,
    dayEndMs,
    dayNow
  );

  // Today's category donut segments (same helper + accent rules as the week/month
  // breakdowns, so the same category/goal renders identically across views).
  const todaySegs: Seg[] = buildCategoryBreakdown(
    todayPerCategory,
    categories,
    activeGoals
  ).map((r) => ({ name: r.name, color: r.color ?? CHART_FALLBACK, ms: r.ms }));

  const catById = new Map(categories.map((c) => [c.id, c] as const));
  // Goal titles for goal-tracked sessions (own goals, RLS-gated → always resolve),
  // so the row can read "Goal: {name}" instead of a bare "Goal".
  const goalTitles = await hydrateGoalTitles(
    [...new Set(daySessions.map((s) => s.goalId).filter((g): g is string => g != null))]
  );
  const sessionRows: SessionToday[] = daySessions.map((s) => {
    const cat = s.categoryId ? catById.get(s.categoryId) : null;
    return {
      kind: "session" as const,
      id: s.id,
      label: s.taskName.trim() || "Untitled session",
      catName: cat?.name ?? null,
      catColor: cat?.color ?? null,
      isGoal: s.goalId !== null,
      goalName: s.goalId ? goalTitles.get(s.goalId) ?? null : null,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      workedMs: sessionWorkedMs(s, dayNow),
      active: s.endedAt === null,
    };
  });
  // Imported calendar events appear as rows alongside sessions — same shape,
  // with a start–end range instead of a live clock. Already fetched above for
  // the totals; exclusions filtered and categories resolved by categorizeEvents.
  const eventRows: SessionToday[] = dayEvents.map((e) => ({
    kind: "event" as const,
    id: e.id,
    label: e.title?.trim() || "(no title)",
    catName: e.category?.name ?? "Uncategorized",
    catColor: e.category?.color ?? null,
    isGoal: false,
    goalName: null,
    startedAt: e.startMs,
    endedAt: e.endMs,
    workedMs: e.endMs - e.startMs,
    active: false,
  }));
  // Chronological, earliest → latest, so the day reads top-to-bottom and the live
  // session (always the most recently started, per the one-active-session rule)
  // sits at the bottom.
  const sessionsToday: SessionToday[] = [...sessionRows, ...eventRows]
    .filter((s) => s.workedMs > 0)
    .sort((a, b) => a.startedAt - b.startedAt);

  const dayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  });
  const dateLabel = dayFmt.format(new Date());
  // "Jul 21 – Jul 27" for the week window, formatted in the user's tz (weekEndMs
  // is the last ms of Sunday, so it renders as Sunday's date).
  const weekRangeLabel = `${dayFmt.format(new Date(weekStartMs))} – ${dayFmt.format(new Date(weekEndMs))}`;

  // --- Goals: week-to-date vs weekly quota (shared by Today + This week) ---
  const goalRows: GoalRow[] = weekRecap.goalRows.map((g) => ({
    id: g.id,
    title: g.title,
    quotaHours: g.quotaHours,
    actualMs: g.actualMs,
    status: g.status,
  }));

  // --- Habits today ---
  const habitsToday: HabitToday[] = habitsStatus.map((h) => ({
    id: h.habit.id,
    name: h.habit.name,
    color: h.habit.color,
    done: h.completedToday,
  }));

  // --- This week donut ---
  const weekSegs: Seg[] = weekRecap.categoryRows.map((r) => ({
    name: r.name,
    color: r.color ?? CHART_FALLBACK,
    ms: r.ms,
  }));

  return {
    dateLabel,
    todayTotalMs,
    todayTracked: daySessions.length,
    todayImported: dayEvents.length,
    todaySegs,
    sessionsToday,
    goals: goalRows,
    habitsToday,
    weekTotalMs: weekRecap.totalTrackedMs,
    weekSegs,
    weekRangeLabel,
    weekTracked: weekRecap.sessionCount,
    weekImported: weekRecap.importedCount,
    weekStart: monday,
    today,
  };
}

// How many weeks of completion history the Manage-habits editor can page back
// through (including the current week). Kept small so the read stays cheap —
// completions are one tiny row per habit per checked day.
export const HABIT_HISTORY_WEEKS = 8;

// The habits + completions for the This-week grid AND the Manage-habits editor.
// Loads the last HABIT_HISTORY_WEEKS weeks so the editor can page back and
// backfill missed days; the This-week grid ignores dates outside its own week,
// so the wider window is harmless there. `minWeekStart` caps how far back the
// editor may navigate.
export async function loadWeekHabits(weekStart: string) {
  const minWeekStart = addDaysISO(weekStart, -7 * (HABIT_HISTORY_WEEKS - 1));
  const [habits, completions] = await Promise.all([
    listActiveHabits(),
    listCompletionsInRange(minWeekStart, addDaysISO(weekStart, 6)),
  ]);
  return { habits, completions, minWeekStart };
}
