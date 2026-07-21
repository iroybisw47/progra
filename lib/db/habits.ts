import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export type Habit = {
  id: string;
  name: string;
  color: string | null;
  createdAt: number;
  archivedAt: number | null;
  // Social v2: false = visible to accepted friends (once Aspect 4 lands), true
  // = owner-only. Completions inherit this. Inert until then.
  isPrivate: boolean;
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
  is_private: boolean;
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
    isPrivate: row.is_private ?? false,
  };
}

function rowToCompletion(row: CompletionRow): HabitCompletion {
  return {
    id: row.id,
    habitId: row.habit_id,
    completedOn: row.completed_on,
  };
}

// Active habits only (archived_at is null), ordered by creation time.
// Cached per request — the progress loader and week-habits loader both read
// habits during one Home render; they share a single round-trip.
export const listActiveHabits = cache(async (): Promise<Habit[]> => {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("habits")
    .select("id, name, color, created_at, archived_at, is_private")
    .eq("user_id", me.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as HabitRow[]).map(rowToHabit);
});

// All habit completions for the user in [startLocalDate, endLocalDate]
// inclusive. RLS scopes to the current user. Cached per request, keyed on the
// date-string window.
export const listCompletionsInRange = cache(async (
  startLocalDate: string,
  endLocalDate: string
): Promise<HabitCompletion[]> => {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_completions")
    .select("id, habit_id, completed_on")
    .eq("user_id", me.id)
    .gte("completed_on", startLocalDate)
    .lte("completed_on", endLocalDate);
  if (!data) return [];
  return (data as CompletionRow[]).map(rowToCompletion);
});

// Returns active habits plus a boolean per habit indicating whether there's
// a completion row for `localDate`. Cached per request.
export const getHabitsWithTodayStatus = cache(async (
  localDate: string
): Promise<HabitWithStatus[]> => {
  const me = await getCurrentUser();
  if (!me) return [];
  const habits = await listActiveHabits();
  if (habits.length === 0) return [];

  const supabase = await createClient();
  const { data: completionData } = await supabase
    .from("habit_completions")
    .select("habit_id")
    .eq("user_id", me.id)
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
});

// Returns all habit completions for a given local date. Currently unused —
// kept for the future day-overview integration outside the dashboard.
export async function getHabitsForDay(
  localDate: string
): Promise<HabitCompletion[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_completions")
    .select("id, habit_id, completed_on")
    .eq("user_id", me.id)
    .eq("completed_on", localDate);

  if (!data) return [];
  return (data as CompletionRow[]).map(rowToCompletion);
}

// Cross-user reads (social v2 profile pages): another user's habits +
// completions. No owner guard — RLS decides visibility (owner → all incl.
// private; accepted friend → non-private; stranger/blocked → none). Completions
// inherit their parent habit's privacy via the RLS policy.
export async function listActiveHabitsForUser(
  userId: string
): Promise<Habit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habits")
    .select("id, name, color, created_at, archived_at, is_private")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as HabitRow[]).map(rowToHabit);
}

export async function listCompletionsForUserInRange(
  userId: string,
  startLocalDate: string,
  endLocalDate: string
): Promise<HabitCompletion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_completions")
    .select("id, habit_id, completed_on")
    .eq("user_id", userId)
    .gte("completed_on", startLocalDate)
    .lte("completed_on", endLocalDate);
  if (!data) return [];
  return (data as CompletionRow[]).map(rowToCompletion);
}
