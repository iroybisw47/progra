"use server";

import { revalidateGoalSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { capText } from "@/lib/validate";

type Result = { ok: true } | { error: string };

// Server-side field caps (clients also cap; never trust the client).
const TITLE_MAX = 120;
const DESC_MAX = 500;

type CreateGoalInput = {
  title: string;
  description?: string;
  weeklyQuotaHours: number;
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

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title,
    description: capText(input.description, DESC_MAX),
    weekly_quota_hours: input.weeklyQuotaHours,
  });

  if (error) return { error: error.message };
  revalidateGoalSurfaces();
  return { ok: true };
}

type UpdateGoalPatch = {
  title?: string;
  description?: string | null;
  weeklyQuotaHours?: number;
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
