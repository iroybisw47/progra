"use server";

import { revalidatePath } from "next/cache";

import { listBusyTimes } from "@/lib/db/calendar-events";
import { listActiveGoals } from "@/lib/db/goals";
import { listPlansForGoals } from "@/lib/db/session-plans";
import { placeWeek } from "@/lib/placement";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };
type RegenerateResult =
  | { ok: true; placed: number; skipped: number }
  | { error: string };

type CreateBlockInput = {
  goalId: string;
  sessionPlanId?: string | null;
  startMs: number;
  endMs: number;
  isFlex?: boolean;
};

export async function createBlock(input: CreateBlockInput): Promise<Result> {
  if (input.endMs <= input.startMs) return { error: "End must be after start" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("scheduled_blocks").insert({
    user_id: user.id,
    goal_id: input.goalId,
    session_plan_id: input.sessionPlanId ?? null,
    start_time: new Date(input.startMs).toISOString(),
    end_time: new Date(input.endMs).toISOString(),
    is_flex: input.isFlex ?? false,
  });
  if (error) return { error: error.message };
  revalidatePath("/plan");
  revalidatePath("/clock");
  return { ok: true };
}

type UpdateBlockPatch = {
  goalId?: string;
  sessionPlanId?: string | null;
  startMs?: number;
  endMs?: number;
  isFlex?: boolean;
  status?: "scheduled" | "done" | "missed" | "moved";
};

export async function updateBlock(
  id: string,
  patch: UpdateBlockPatch
): Promise<Result> {
  const update: Record<string, unknown> = {};
  if (patch.goalId !== undefined) update.goal_id = patch.goalId;
  if (patch.sessionPlanId !== undefined) update.session_plan_id = patch.sessionPlanId;
  if (patch.startMs !== undefined) {
    update.start_time = new Date(patch.startMs).toISOString();
  }
  if (patch.endMs !== undefined) {
    update.end_time = new Date(patch.endMs).toISOString();
  }
  if (patch.isFlex !== undefined) update.is_flex = patch.isFlex;
  if (patch.status !== undefined) update.status = patch.status;

  // Cross-field validation: if both timestamps are being patched, end must
  // be after start.
  if (patch.startMs !== undefined && patch.endMs !== undefined) {
    if (patch.endMs <= patch.startMs) return { error: "End must be after start" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_blocks")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/plan");
  revalidatePath("/clock");
  return { ok: true };
}

export async function deleteBlock(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_blocks")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/plan");
  revalidatePath("/clock");
  return { ok: true };
}

// Wipe this week's 'scheduled' blocks for the user and re-propose. Done/missed/
// moved blocks are preserved as history. Returns counts so the client can show
// "placed N, skipped M" feedback.
export async function regenerateWeek(
  weekStartMs: number,
  weekEndMs: number
): Promise<RegenerateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: deleteErr } = await supabase
    .from("scheduled_blocks")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "scheduled")
    .gte("start_time", new Date(weekStartMs).toISOString())
    .lt("start_time", new Date(weekEndMs).toISOString());
  if (deleteErr) return { error: deleteErr.message };

  const [goals, busy] = await Promise.all([
    listActiveGoals(),
    listBusyTimes(weekStartMs, weekEndMs),
  ]);
  const plans =
    goals.length > 0 ? await listPlansForGoals(goals.map((g) => g.id)) : [];

  const { placed, skipped } = placeWeek({
    goals,
    plans,
    busy,
    weekStartMs,
    weekEndMs,
    wakingStartHour: 8,
    wakingEndHour: 23,
  });

  if (placed.length > 0) {
    const rows = placed.map((b) => ({
      user_id: user.id,
      goal_id: b.goalId,
      session_plan_id: b.sessionPlanId,
      start_time: new Date(b.startMs).toISOString(),
      end_time: new Date(b.endMs).toISOString(),
      is_flex: b.isFlex,
    }));
    const { error: insertErr } = await supabase
      .from("scheduled_blocks")
      .insert(rows);
    if (insertErr) return { error: insertErr.message };
  }

  revalidatePath("/plan");
  revalidatePath("/clock");
  return { ok: true, placed: placed.length, skipped: skipped.length };
}
