import "server-only";

import { cache } from "react";

import { isoDateInTimeZone } from "@/lib/dates";
import { listAllGoals } from "@/lib/db/goals";
import { listActiveHabits, listCompletionsInRange } from "@/lib/db/habits";
import { listSessionsInRange } from "@/lib/db/sessions";
import {
  goalCompletionFrom,
  habitCompletionFrom,
  type GoalCompletion,
  type HabitCompletion,
} from "@/lib/history-stats";

export type {
  GoalCompletion,
  GoalCompletionRow,
  HabitCalendarDay,
  HabitCompletion,
  HabitRateRow,
} from "@/lib/history-stats";

// Loaders for the two History sections the month/year rollups don't cover. The
// math lives in lib/history-stats.ts (pure, unit-tested); these just fetch.
// Both read through the same cache()d helpers the rollup uses, so a History
// render costs one extra round-trip, not five.

export const computeGoalCompletion = cache(
  async (
    startMs: number,
    endMs: number,
    tz: string
  ): Promise<GoalCompletion> => {
    const [goals, sessions] = await Promise.all([
      listAllGoals(),
      // Same window the rollup just asked for, so this is a cache hit.
      listSessionsInRange(startMs, endMs),
    ]);
    return goalCompletionFrom(goals, sessions, {
      startMs,
      endMs,
      tz,
      now: Date.now(),
    });
  }
);

export const computeHabitCompletion = cache(
  async (
    startMs: number,
    endMs: number,
    todayISO: string,
    tz: string,
    includeCalendar: boolean
  ): Promise<HabitCompletion> => {
    const startISO = isoDateInTimeZone(startMs, tz);
    const endISO = isoDateInTimeZone(endMs, tz);
    // Completions are only read up to today — the window can run into the
    // future (the live month/year) and nothing is recorded there.
    const lastISO = endISO < todayISO ? endISO : todayISO;
    if (lastISO < startISO) {
      return { overallRate: 0, perHabit: [], calendar: [] };
    }
    const [habits, checks] = await Promise.all([
      // Active only: "Delete" in the UI just stamps `archived_at`, so a habit
      // the user deleted must not keep scoring here.
      listActiveHabits(),
      listCompletionsInRange(startISO, lastISO),
    ]);
    return habitCompletionFrom(habits, checks, {
      startISO,
      endISO,
      todayISO,
      tz,
      includeCalendar,
    });
  }
);
