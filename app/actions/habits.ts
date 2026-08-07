"use server";

import { CATEGORY_COLORS, isCategoryColor } from "@/lib/category-colors";
import { revalidateHabitSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/dates";
import {
  MAX_ACTIVE_HABITS,
  canAddHabit,
  shouldPostCheckoffToFeed,
} from "@/lib/habits";

type Result = { ok: true } | { error: string };

export async function createHabit(
  name: string,
  color?: string
): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name required" };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  // Cap on ACTIVE habits — archived ones don't count, so archiving frees a slot.
  // The UI disables its add control at the same number; this is the backstop,
  // and the wording is user-facing because a client can always call an action
  // directly.
  const { count: activeCount } = await supabase
    .from("habits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (!canAddHabit(activeCount ?? 0)) {
    return {
      error: `You can have up to ${MAX_ACTIVE_HABITS} habits. Archive one to add another.`,
    };
  }

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
  revalidateHabitSurfaces();
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
  revalidateHabitSurfaces();
  return { ok: true };
}

export async function archiveHabit(habitId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", habitId);
  if (error) return { error: error.message };
  revalidateHabitSurfaces();
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
  const user = await getCurrentUser();
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
    // posted_at is what puts a check-off in friends' feeds, and it's set ONLY
    // when you're checking off today. Backfilling a missed day is catch-up
    // bookkeeping, not a moment worth broadcasting — and without this rule a
    // card would announce "just now" about last Tuesday.
    //
    // Storing it beats deriving it later: `completed_on` is a date in the
    // author's timezone and `created_at` is a timestamptz, so a reader would
    // otherwise have to join every author's profile timezone just to work out
    // whether the two describe the same day. It doubles as the feed sort key.
    const isToday = shouldPostCheckoffToFeed(localDate, serverToday);
    const { error } = await supabase.from("habit_completions").insert({
      user_id: user.id,
      habit_id: habitId,
      completed_on: localDate,
      posted_at: isToday ? new Date().toISOString() : null,
    });
    if (error) return { error: error.message };
  }

  revalidateHabitSurfaces();
  return { ok: true };
}
