import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Habit = {
  id: string;
  name: string;
  color: string | null;
  createdAt: number;
  archivedAt: number | null;
};

export type HabitWithStatus = {
  habit: Habit;
  completedToday: boolean;
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  completedOn: string; // YYYY-MM-DD
};

type HabitRow = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  archived_at: string | null;
};

type CompletionRow = {
  id: string;
  habit_id: string;
  completed_on: string;
};

function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: new Date(row.created_at).getTime(),
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  };
}

// Returns active habits plus a boolean per habit indicating whether there's
// a completion row for `localDate` (YYYY-MM-DD in the user's local tz).
export async function getHabitsWithTodayStatus(
  localDate: string
): Promise<HabitWithStatus[]> {
  const supabase = await createClient();

  const { data: habitData } = await supabase
    .from("habits")
    .select("id, name, color, created_at, archived_at")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (!habitData) return [];
  const habits = (habitData as HabitRow[]).map(rowToHabit);
  if (habits.length === 0) return [];

  const { data: completionData } = await supabase
    .from("habit_completions")
    .select("habit_id")
    .eq("completed_on", localDate)
    .in(
      "habit_id",
      habits.map((h) => h.id)
    );

  const doneIds = new Set(
    (completionData ?? []).map((r) => (r as { habit_id: string }).habit_id)
  );

  return habits.map((h) => ({
    habit: h,
    completedToday: doneIds.has(h.id),
  }));
}

// Returns all habit completions for a given local date. Currently unused —
// will feed the future day-overview integration.
export async function getHabitsForDay(
  localDate: string
): Promise<HabitCompletion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_completions")
    .select("id, habit_id, completed_on")
    .eq("completed_on", localDate);

  if (!data) return [];
  return (data as CompletionRow[]).map((r) => ({
    id: r.id,
    habitId: r.habit_id,
    completedOn: r.completed_on,
  }));
}
