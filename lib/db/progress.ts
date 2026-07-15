import "server-only";

import { aggregateRange } from "@/lib/aggregate";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import {
  getHabitsWithTodayStatus,
  listActiveHabits,
  listCompletionsInRange,
} from "@/lib/db/habits";
import { computeMonthRollup } from "@/lib/db/rollups";
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
  sessionsToday: SessionToday[];
  goals: GoalRow[];
  habitsToday: HabitToday[];
  weekTotalMs: number;
  weekSegs: Seg[];
  weekStart: string;
  today: string;
  monthLabel: string;
  monthTotalMs: number;
  monthSegs: Seg[];
};

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

  const [categories, weekRecap, monthRollup, habitsStatus] =
    await Promise.all([
      listCategories(),
      computeWeekRecap(weekStartMs, weekEndMs),
      computeMonthRollup(new Date()),
      getHabitsWithTodayStatus(today),
    ]);

  // --- Today window ---
  const [daySessions, dayEvents] = await Promise.all([
    listSessionsInRange(dayStartMs, dayEndMs),
    listEventsInRange(dayStartMs, dayEndMs, categories),
  ]);
  const dayNow = Math.min(now, dayEndMs);
  const { total: todayTotalMs } = aggregateRange(
    daySessions,
    dayEvents,
    dayStartMs,
    dayEndMs,
    dayNow
  );

  const catById = new Map(categories.map((c) => [c.id, c] as const));
  const sessionsToday: SessionToday[] = daySessions
    .map((s) => {
      const cat = s.categoryId ? catById.get(s.categoryId) : null;
      return {
        id: s.id,
        label: s.taskName.trim() || "Untitled session",
        catName: cat?.name ?? null,
        catColor: cat?.color ?? null,
        isGoal: s.goalId !== null,
        startedAt: s.startedAt,
        workedMs: sessionWorkedMs(s, dayNow),
        active: s.endedAt === null,
      };
    })
    .filter((s) => s.workedMs > 0)
    .sort((a, b) => b.startedAt - a.startedAt);

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  }).format(new Date());

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

  // --- History (current month) donut ---
  const monthSegs: Seg[] = monthRollup.categoryRows.map((r) => ({
    name: r.name,
    color: r.color ?? CHART_FALLBACK,
    ms: r.ms,
  }));
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "long",
    year: "numeric",
  }).format(new Date());

  return {
    dateLabel,
    todayTotalMs,
    todayTracked: daySessions.length,
    todayImported: dayEvents.length,
    sessionsToday,
    goals: goalRows,
    habitsToday,
    weekTotalMs: weekRecap.totalTrackedMs,
    weekSegs,
    weekStart: monday,
    today,
    monthLabel,
    monthTotalMs: monthRollup.totalTrackedMs,
    monthSegs,
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
