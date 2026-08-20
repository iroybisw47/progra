"use server";

import { revalidateGoalSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { capText } from "@/lib/validate";
import { isCategoryColor } from "@/lib/category-colors";
import { requireSeat } from "@/lib/auth/require-seat";

type Result = { ok: true } | { error: string };

// Server-side field caps (clients also cap; never trust the client).
const TITLE_MAX = 120;
const DESC_MAX = 500;

type CreateGoalInput = {
  title: string;
  description?: string;
  weeklyQuotaHours: number;
  // Must be one of the nine palette hues; anything else is rejected rather
  // than stored, same rule categories and habits follow.
  color?: string | null;
};

export async function createGoal(input: CreateGoalInput): Promise<Result> {
  const title = capText(input.title, TITLE_MAX);
  if (!title) return { error: "Title required" };
  if (!Number.isFinite(input.weeklyQuotaHours) || input.weeklyQuotaHours <= 0) {
    return { error: "Weekly quota must be a positive number" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  // null clears the color (back to the id-derived fallback); an unrecognised
  // value is rejected outright so freehand hexes can't drift in.
  if (input.color != null && !isCategoryColor(input.color)) {
    return { error: "Unknown color" };
  }

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title,
    description: capText(input.description, DESC_MAX),
    weekly_quota_hours: input.weeklyQuotaHours,
    color: input.color ?? null,
  });

  if (error) return { error: error.message };
  revalidateGoalSurfaces();
  return { ok: true };
}

type UpdateGoalPatch = {
  title?: string;
  description?: string | null;
  weeklyQuotaHours?: number;
  color?: string | null;
  // Social v2: true = owner-only, false = visible to accepted friends (Aspect 4).
  isPrivate?: boolean;
};

export async function updateGoal(
  id: string,
  patch: UpdateGoalPatch
): Promise<Result> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = capText(patch.title, TITLE_MAX);
    if (!t) return { error: "Title required" };
    update.title = t;
  }
  if (patch.description !== undefined) {
    update.description = capText(patch.description, DESC_MAX);
  }
  if (patch.weeklyQuotaHours !== undefined) {
    if (
      !Number.isFinite(patch.weeklyQuotaHours) ||
      patch.weeklyQuotaHours <= 0
    ) {
      return { error: "Weekly quota must be a positive number" };
    }
    update.weekly_quota_hours = patch.weeklyQuotaHours;
  }
  if (patch.color !== undefined) {
    if (patch.color != null && !isCategoryColor(patch.color)) {
      return { error: "Unknown color" };
    }
    update.color = patch.color;
  }
  if (patch.isPrivate !== undefined) {
    update.is_private = patch.isPrivate;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("goals").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidateGoalSurfaces();
  return { ok: true };
}

export async function archiveGoal(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateGoalSurfaces();
  return { ok: true };
}
