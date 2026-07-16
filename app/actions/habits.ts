"use server";

import { revalidatePath } from "next/cache";

import { CATEGORY_COLORS, isCategoryColor } from "@/lib/category-colors";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/dates";

type Result = { ok: true } | { error: string };

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

  // Auto-assign from the shared 12-swatch palette (same one categories use),
  // cycling by existing habit count. Editable afterwards via updateHabit.
  let chosenColor: string | null = color ?? null;
  if (!chosenColor) {
    const { count } = await supabase
      .from("habits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    chosenColor = CATEGORY_COLORS[(count ?? 0) % CATEGORY_COLORS.length].value;
  }

  const { error } = await supabase
    .from("habits")
    .insert({ user_id: user.id, name: trimmed, color: chosenColor });

  if (error) return { error: error.message };
  revalidatePath("/habits");
  revalidatePath("/");
  return { ok: true };
}

type UpdateHabitPatch = {
  name?: string;
  // A palette hex value, or null to clear. Omit to leave untouched.
  color?: string | null;
  // Social v2: true = owner-only, false = visible to accepted friends (Aspect 4).
  isPrivate?: boolean;
};

export async function updateHabit(
  habitId: string,
  patch: UpdateHabitPatch
): Promise<Result> {
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "Name required" };
    update.name = trimmed;
  }
  if (patch.color !== undefined) {
    if (patch.color !== null && !isCategoryColor(patch.color)) {
      return { error: "Pick a color from the palette" };
    }
    update.color = patch.color;
  }
  if (patch.isPrivate !== undefined) {
    update.is_private = patch.isPrivate;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update(update)
    .eq("id", habitId);
  if (error) return { error: error.message };

  // Habits render on /habits and the home dashboard.
  revalidatePath("/habits");
  revalidatePath("/");
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
  revalidatePath("/");
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
    .eq("user_id", user.id)
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
  // Progress (/) surfaces today's + this-week's completions in the redesign.
  revalidatePath("/");
  return { ok: true };
}
