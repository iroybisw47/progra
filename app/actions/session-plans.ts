"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

type CreateSessionPlanInput = {
  goalId: string;
  title: string;
  targetHours?: number;
};

export async function createSessionPlan(
  input: CreateSessionPlanInput
): Promise<Result> {
  const title = input.title.trim();
  if (!title) return { error: "Title required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Append at the end: max(existing sort_order) + 1, or 0 for the first plan.
  const { data: tail } = await supabase
    .from("session_plans")
    .select("sort_order")
    .eq("goal_id", input.goalId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder =
    tail && tail.length > 0
      ? (tail[0] as { sort_order: number }).sort_order + 1
      : 0;

  const { error } = await supabase.from("session_plans").insert({
    user_id: user.id,
    goal_id: input.goalId,
    sort_order: nextOrder,
    title,
    target_hours: input.targetHours ?? 2,
  });

  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/clock");
  return { ok: true };
}

type UpdateSessionPlanPatch = {
  title?: string;
  targetHours?: number;
  status?: "planned" | "done";
};

export async function updateSessionPlan(
  id: string,
  patch: UpdateSessionPlanPatch
): Promise<Result> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { error: "Title required" };
    update.title = t;
  }
  if (patch.targetHours !== undefined) {
    if (!Number.isFinite(patch.targetHours) || patch.targetHours <= 0) {
      return { error: "Target hours must be a positive number" };
    }
    update.target_hours = patch.targetHours;
  }
  if (patch.status !== undefined) update.status = patch.status;

  const supabase = await createClient();
  const { error } = await supabase
    .from("session_plans")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/clock");
  return { ok: true };
}

export async function deleteSessionPlan(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("session_plans")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/goals");
  revalidatePath("/clock");
  return { ok: true };
}

// Reorder by writing sort_order = index for each id in the given order.
// No unique constraint on (goal_id, sort_order), so a single pass is safe.
export async function reorderSessionPlans(
  goalId: string,
  orderedIds: string[]
): Promise<Result> {
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("session_plans")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("goal_id", goalId);
    if (error) return { error: error.message };
  }
  revalidatePath("/goals");
  revalidatePath("/clock");
  return { ok: true };
}
