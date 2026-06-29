"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/dates";

type Result = { ok: true } | { error: string };

// Small auto-assign palette. Cycles by existing habit count. Soft/desaturated
// to match the warm redesign (no alarmist red). Existing habits keep the color
// stored at creation time; this only affects newly added habits.
const PALETTE = [
  "#b07a52", // clay
  "#6e84a8", // periwinkle
  "#6e9277", // sage
  "#c2a24e", // gold
  "#9d7fa0", // muted plum
  "#5f8c8c", // muted teal
  "#c08a6a", // terracotta
  "#8a9a6e", // olive
];

export async function createHabit(
  name: string,
  color?: string
): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let chosenColor: string | null = color ?? null;
  if (!chosenColor) {
    const { count } = await supabase
      .from("habits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    chosenColor = PALETTE[(count ?? 0) % PALETTE.length];
  }

  const { error } = await supabase
    .from("habits")
    .insert({ user_id: user.id, name: trimmed, color: chosenColor });

  if (error) return { error: error.message };
  revalidatePath("/habits");
  return { ok: true };
}

export async function archiveHabit(habitId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", habitId);
  if (error) return { error: error.message };
  revalidatePath("/habits");
  return { ok: true };
}

// Toggles a habit completion for `localDate`. Past days and today are allowed
// (backfilling missed days); future days are rejected against the user's stored
// timezone. Date comparison is lexical, which is chronological for YYYY-MM-DD.
export async function toggleHabitCompletion(
  habitId: string,
  localDate: string
): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return { error: "Invalid date" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const tz =
    (profile as { timezone: string | null } | null)?.timezone ?? "UTC";
  const serverToday = todayInTimeZone(tz);
  if (localDate > serverToday) {
    return { error: "Can't check off a future day" };
  }

  const { data: existing } = await supabase
    .from("habit_completions")
    .select("id")
    .eq("habit_id", habitId)
    .eq("completed_on", localDate)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("habit_completions")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("habit_completions").insert({
      user_id: user.id,
      habit_id: habitId,
      completed_on: localDate,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/habits");
  return { ok: true };
}
