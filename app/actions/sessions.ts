"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { listSessionHistory } from "@/lib/db/sessions";
import type { Session } from "@/lib/storage";

type Result = { ok: true } | { error: string };

// Paginated read for the /sessions history browser. RLS scopes to the user.
export async function loadSessionHistory(opts: {
  categoryId?: string | "none" | null;
  beforeMs?: number | null;
}): Promise<Session[]> {
  return listSessionHistory(opts);
}

type ClockInInput = {
  categoryId?: string | null;
  goalId?: string | null;
  taskName: string;
  description?: string;
};

// A clock-in counts toward EITHER a category OR a goal — never both, never
// neither. Returns an error string when that invariant is violated.
function resolveAxis(
  categoryId: string | null | undefined,
  goalId: string | null | undefined
): { categoryId: string | null; goalId: string | null } | { error: string } {
  const cat = categoryId ?? null;
  const goal = goalId ?? null;
  if ((cat === null) === (goal === null)) {
    return { error: "Pick a category or a goal" };
  }
  return { categoryId: cat, goalId: goal };
}

export async function clockIn(input: ClockInInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const axis = resolveAxis(input.categoryId, input.goalId);
  if ("error" in axis) return axis;

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    category_id: axis.categoryId,
    goal_id: axis.goalId,
    task_name: input.taskName.trim(),
    description: input.description?.trim() || null,
    started_at: new Date().toISOString(),
    ended_at: null,
  });

  if (error) {
    // Partial unique index enforces one active session per user.
    if (error.code === "23505") {
      return { error: "Already clocked in to another task" };
    }
    return { error: error.message };
  }

  revalidatePath("/clock");
  revalidatePath("/goals");
  return { ok: true };
}

export async function clockOut(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Read the active session first: needed to flip an attached plan to 'done'
  // and to settle an in-progress pause into pausedMs at clock-out.
  const { data: active } = await supabase
    .from("sessions")
    .select("session_plan_id, paused_ms, paused_since")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const now = Date.now();
  const row = active as {
    session_plan_id: string | null;
    paused_ms: number | string | null;
    paused_since: string | null;
  } | null;

  // If we clock out mid-pause, bank that final pause segment so worked time is
  // computed correctly, and clear paused_since.
  let pausedMs = row?.paused_ms != null ? Number(row.paused_ms) : 0;
  if (row?.paused_since) {
    pausedMs += Math.max(0, now - new Date(row.paused_since).getTime());
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date(now).toISOString(),
      paused_ms: pausedMs,
      paused_since: null,
    })
    .eq("user_id", user.id)
    .is("ended_at", null);

  if (error) return { error: error.message };

  const planId = row?.session_plan_id ?? null;
  if (planId) {
    await supabase
      .from("session_plans")
      .update({ status: "done" })
      .eq("id", planId);
  }

  revalidatePath("/clock");
  revalidatePath("/goals");
  return { ok: true };
}

// Pause the active session: stamp paused_since so worked time stops
// accumulating. No-op if there's no active session or it's already paused.
export async function pauseSession(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: active } = await supabase
    .from("sessions")
    .select("id, paused_since")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const row = active as { id: string; paused_since: string | null } | null;
  if (!row) return { error: "No active session" };
  if (row.paused_since) return { ok: true }; // already paused

  const { error } = await supabase
    .from("sessions")
    .update({ paused_since: new Date().toISOString() })
    .eq("id", row.id);
  if (error) return { error: error.message };

  revalidatePath("/clock");
  return { ok: true };
}

// Resume the active session: bank the just-finished pause segment into
// paused_ms and clear paused_since. No-op if not currently paused.
export async function resumeSession(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: active } = await supabase
    .from("sessions")
    .select("id, paused_ms, paused_since")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const row = active as {
    id: string;
    paused_ms: number | string | null;
    paused_since: string | null;
  } | null;
  if (!row) return { error: "No active session" };
  if (!row.paused_since) return { ok: true }; // not paused

  const banked = row.paused_ms != null ? Number(row.paused_ms) : 0;
  const pausedMs =
    banked + Math.max(0, Date.now() - new Date(row.paused_since).getTime());

  const { error } = await supabase
    .from("sessions")
    .update({ paused_ms: pausedMs, paused_since: null })
    .eq("id", row.id);
  if (error) return { error: error.message };

  revalidatePath("/clock");
  return { ok: true };
}

type CreateSessionInput = {
  categoryId?: string | null;
  goalId?: string | null;
  taskName: string;
  description?: string;
  startedAt: number; // ms
  endedAt: number; // ms
};

export async function createSession(input: CreateSessionInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const axis = resolveAxis(input.categoryId, input.goalId);
  if ("error" in axis) return axis;

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    category_id: axis.categoryId,
    goal_id: axis.goalId,
    task_name: input.taskName.trim(),
    description: input.description?.trim() || null,
    started_at: new Date(input.startedAt).toISOString(),
    ended_at: new Date(input.endedAt).toISOString(),
  });

  if (error) return { error: error.message };
  revalidatePath("/clock");
  revalidatePath("/goals");
  return { ok: true };
}

type UpdateSessionPatch = {
  // Provide categoryId OR goalId to switch a session's axis (the other is set
  // to null). Omit both to leave the axis untouched (e.g. a notes-only save).
  categoryId?: string | null;
  goalId?: string | null;
  taskName?: string;
  description?: string;
  startedAt?: number;
  endedAt?: number | null;
};

export async function updateSession(
  id: string,
  patch: UpdateSessionPatch
): Promise<Result> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.categoryId !== undefined || patch.goalId !== undefined) {
    const axis = resolveAxis(patch.categoryId, patch.goalId);
    if ("error" in axis) return axis;
    update.category_id = axis.categoryId;
    update.goal_id = axis.goalId;
  }
  if (patch.taskName !== undefined) update.task_name = patch.taskName.trim();
  if (patch.description !== undefined) {
    update.description = patch.description.trim() || null;
  }
  if (patch.startedAt !== undefined) {
    update.started_at = new Date(patch.startedAt).toISOString();
  }
  if (patch.endedAt !== undefined) {
    update.ended_at = patch.endedAt === null ? null : new Date(patch.endedAt).toISOString();
  }

  const { error } = await supabase.from("sessions").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clock");
  revalidatePath("/goals");
  return { ok: true };
}

export async function deleteSession(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clock");
  revalidatePath("/goals");
  revalidatePath("/history");
  revalidatePath("/recap");
  return { ok: true };
}
