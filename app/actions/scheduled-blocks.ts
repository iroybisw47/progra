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
type SweepResult =
  | { ok: true; markedDone: number; markedMissed: number }
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

// Sweep: walk past 'scheduled' blocks within the last ~2 weeks and decide
// whether each was completed (a matching session overlaps the block window)
// or missed. Runs on /plan and / (home) page load — PWAs have no background
// jobs, so detection has to be lazy. Bounded window keeps the sweep cheap
// per page render; bumping the window would require a stricter cadence.
const SWEEP_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

type SessionForSweep = {
  session_plan_id: string | null;
  started_at: string;
  ended_at: string | null;
};

type BlockForSweep = {
  id: string;
  goal_id: string;
  session_plan_id: string | null;
  start_time: string;
  end_time: string;
};

type PlanForSweep = { id: string; goal_id: string };

export async function sweepPastBlocks(nowMs?: number): Promise<SweepResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const now = nowMs ?? Date.now();
  const sinceIso = new Date(now - SWEEP_WINDOW_DAYS * DAY_MS).toISOString();
  const nowIso = new Date(now).toISOString();

  // All three reads in parallel — RLS scopes by user.
  const [blocksRes, sessionsRes, plansRes] = await Promise.all([
    supabase
      .from("scheduled_blocks")
      .select("id, goal_id, session_plan_id, start_time, end_time")
      .eq("status", "scheduled")
      .lt("end_time", nowIso)
      .gt("end_time", sinceIso),
    supabase
      .from("sessions")
      .select("session_plan_id, started_at, ended_at")
      // Sessions starting in or overlapping the window. An active session
      // (ended_at null) that started before the window but is still going
      // would still be relevant if its block window is recent — covered by
      // the "or started_at >= since" alternative.
      .or(`started_at.gte.${sinceIso},ended_at.is.null`),
    supabase.from("session_plans").select("id, goal_id"),
  ]);

  const candidateBlocks = (blocksRes.data ?? []) as BlockForSweep[];
  if (candidateBlocks.length === 0) {
    return { ok: true, markedDone: 0, markedMissed: 0 };
  }

  const sessions = (sessionsRes.data ?? []) as SessionForSweep[];
  const plans = (plansRes.data ?? []) as PlanForSweep[];
  const planToGoal = new Map<string, string>(
    plans.map((p) => [p.id, p.goal_id])
  );

  // Pre-parse sessions to ms once. Active session's effective end = now (so
  // a still-running clock-in counts as covering the block up to this moment).
  const parsedSessions = sessions.map((s) => ({
    sessionPlanId: s.session_plan_id,
    startedMs: new Date(s.started_at).getTime(),
    endedMs: s.ended_at ? new Date(s.ended_at).getTime() : now,
  }));

  const doneIds: string[] = [];
  const missedIds: string[] = [];

  for (const blk of candidateBlocks) {
    const blockStartMs = new Date(blk.start_time).getTime();
    const blockEndMs = new Date(blk.end_time).getTime();
    let done = false;

    for (const s of parsedSessions) {
      if (!s.sessionPlanId) continue; // unattributed sessions never count
      // Overlap test: session window ∩ block window ≠ ∅
      if (s.startedMs >= blockEndMs) continue;
      if (s.endedMs <= blockStartMs) continue;

      if (blk.session_plan_id) {
        // Plan-bound block — exact plan match required.
        if (s.sessionPlanId === blk.session_plan_id) {
          done = true;
          break;
        }
      } else {
        // Goal-time block — match via plan→goal so any session in this goal
        // overlapping the window counts.
        const sessionGoalId = planToGoal.get(s.sessionPlanId);
        if (sessionGoalId === blk.goal_id) {
          done = true;
          break;
        }
      }
    }

    if (done) doneIds.push(blk.id);
    else missedIds.push(blk.id);
  }

  // Batch the writes — two UPDATEs at most.
  if (doneIds.length > 0) {
    const { error } = await supabase
      .from("scheduled_blocks")
      .update({ status: "done" })
      .in("id", doneIds);
    if (error) return { error: error.message };
  }
  if (missedIds.length > 0) {
    const { error } = await supabase
      .from("scheduled_blocks")
      .update({ status: "missed" })
      .in("id", missedIds);
    if (error) return { error: error.message };
  }

  return {
    ok: true,
    markedDone: doneIds.length,
    markedMissed: missedIds.length,
  };
}

type AcceptReslotInput = {
  missedBlockId: string;
  newStartMs: number;
  newEndMs: number;
};

// Accept a re-slot proposal (or custom time): inserts a new 'scheduled' block
// pointing back at the missed one via rescheduled_from, and flips the old
// block to 'moved' so it stops appearing in the "needs reslotting" surface
// but still exists for history/lineage.
export async function acceptReslot(
  input: AcceptReslotInput
): Promise<Result> {
  if (input.newEndMs <= input.newStartMs) {
    return { error: "End must be after start" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: missed } = await supabase
    .from("scheduled_blocks")
    .select("id, goal_id, session_plan_id, is_flex, status")
    .eq("id", input.missedBlockId)
    .maybeSingle();
  if (!missed) return { error: "Original block not found" };
  if ((missed as { status: string }).status !== "missed") {
    return { error: "Block is not missed" };
  }

  const m = missed as {
    id: string;
    goal_id: string;
    session_plan_id: string | null;
    is_flex: boolean;
  };

  const { error: insertErr } = await supabase.from("scheduled_blocks").insert({
    user_id: user.id,
    goal_id: m.goal_id,
    session_plan_id: m.session_plan_id,
    start_time: new Date(input.newStartMs).toISOString(),
    end_time: new Date(input.newEndMs).toISOString(),
    is_flex: m.is_flex,
    status: "scheduled",
    rescheduled_from: m.id,
  });
  if (insertErr) return { error: insertErr.message };

  const { error: updateErr } = await supabase
    .from("scheduled_blocks")
    .update({ status: "moved" })
    .eq("id", m.id);
  if (updateErr) return { error: updateErr.message };

  revalidatePath("/plan");
  revalidatePath("/");
  return { ok: true };
}

export async function dismissMissedBlock(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_blocks")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "missed");
  if (error) return { error: error.message };
  revalidatePath("/plan");
  revalidatePath("/");
  return { ok: true };
}
