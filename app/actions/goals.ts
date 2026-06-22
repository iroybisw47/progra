"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

type CreateGoalInput = {
  title: string;
  description?: string;
  weeklyQuotaHours: number;
};

export async function createGoal(input: CreateGoalInput): Promise<Result> {
  const title = input.title.trim();
  if (!title) return { error: "Title required" };
  if (!Number.isFinite(input.weeklyQuotaHours) || input.weeklyQuotaHours <= 0) {
    return { error: "Weekly quota must be a positive number" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title,
    description: input.description?.trim() || null,
    weekly_quota_hours: input.weeklyQuotaHours,
  });

  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/clock");
  return { ok: true };
}

type UpdateGoalPatch = {
  title?: string;
  description?: string | null;
  weeklyQuotaHours?: number;
};

export async function updateGoal(
  id: string,
  patch: UpdateGoalPatch
): Promise<Result> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { error: "Title required" };
    update.title = t;
  }
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null;
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

  const supabase = await createClient();
  const { error } = await supabase.from("goals").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/clock");
  return { ok: true };
}

export async function archiveGoal(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/clock");
  return { ok: true };
}
