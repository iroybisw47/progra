"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/dates";

type Result = { ok: true } | { error: string };

// Small auto-assign palette. Cycles by existing habit count.
const PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
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

// Toggles today's completion for a habit. Server-side reject if `localDate`
// isn't today in the user's stored timezone — clients can't backfill or
// edit past days through this endpoint.
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
  if (localDate !== serverToday) {
    return { error: "Can only check off today" };
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
