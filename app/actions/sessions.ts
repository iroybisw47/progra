"use server";

import {
  revalidateSessionSurfaces,
  revalidateSessionSurfacesExceptLive,
} from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/db/categories";
import { listHistoryPage, type HistoryItem } from "@/lib/db/history";
import { capText } from "@/lib/validate";

type Result = { ok: true } | { error: string };

// Server-side field caps (clients also cap; never trust the client).
const TASK_MAX = 200;
const SESSION_DESC_MAX = 1000;

// Paginated read for the /sessions history browser: timer sessions merged
// with synced calendar events. RLS scopes to the user.
export async function loadSessionHistory(opts: {
  categoryId?: string | "none" | null;
  beforeMs?: number | null;
}): Promise<HistoryItem[]> {
  const categories = await listCategories();
  return listHistoryPage({ ...opts, categories });
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

// Returns the new session id so the caller (clock flow) can attach a "before"
// photo to it without an extra round-trip.
export async function clockIn(
  input: ClockInInput
): Promise<{ ok: true; sessionId: string } | { error: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const axis = resolveAxis(input.categoryId, input.goalId);
  if ("error" in axis) return axis;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      category_id: axis.categoryId,
      goal_id: axis.goalId,
      task_name: capText(input.taskName, TASK_MAX),
      description: capText(input.description, SESSION_DESC_MAX),
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .select("id")
    .single();

  if (error) {
    // Partial unique index enforces one active session per user.
    if (error.code === "23505") {
      return { error: "Already clocked in to another task" };
    }
    return { error: error.message };
  }

  revalidateSessionSurfaces();
  return { ok: true, sessionId: (data as { id: string }).id };
}

// Returns the ended session's id so the redesign clock flow can route straight
// to the Finish & save screen for it.
export async function clockOut(): Promise<
  { ok: true; sessionId: string } | { error: string }
> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  // Read the active session first: needed to settle an in-progress pause
  // into pausedMs at clock-out, and to return its id.
  const { data: active } = await supabase
    .from("sessions")
    .select("id, paused_ms, paused_since")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const now = Date.now();
  const row = active as {
    id: string;
    paused_ms: number | string | null;
    paused_since: string | null;
  } | null;
  if (!row) return { error: "No active session" };

  // If we clock out mid-pause, bank that final pause segment so worked time is
  // computed correctly, and clear paused_since.
  let pausedMs = row.paused_ms != null ? Number(row.paused_ms) : 0;
  if (row.paused_since) {
    pausedMs += Math.max(0, now - new Date(row.paused_since).getTime());
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date(now).toISOString(),
      paused_ms: pausedMs,
      paused_since: null,
    })
    .eq("id", row.id);

  if (error) return { error: error.message };

  // Caller navigates from /clock/live to /clock/finish next — don't re-render
  // the live page's redirect guard in this POST.
  revalidateSessionSurfacesExceptLive();
  return { ok: true, sessionId: row.id };
}

// Correct an active session's start (and optionally end it at a chosen time) —
// the Edit-time control on the live timer, for when you forgot to clock out.
// Passing endedAtMs finalizes the session (settling any in-progress pause);
// null leaves it running with the corrected start.
export async function editActiveSessionTime(input: {
  startedAtMs: number;
  endedAtMs: number | null;
}): Promise<
  { ok: true; sessionId: string; ended: boolean } | { error: string }
> {
  const supabase = await createClient();
  const user = await getCurrentUser();
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

  const now = Date.now();
  const { startedAtMs, endedAtMs } = input;
  if (!Number.isFinite(startedAtMs)) return { error: "Invalid start time" };
  if (startedAtMs > now) return { error: "Start can't be in the future" };

  const update: Record<string, unknown> = {
    started_at: new Date(startedAtMs).toISOString(),
  };
  let ended = false;

  if (endedAtMs !== null) {
    if (!Number.isFinite(endedAtMs)) return { error: "Invalid end time" };
    if (endedAtMs > now) return { error: "End can't be in the future" };
    if (endedAtMs <= startedAtMs) return { error: "End must be after start" };

    // Settle any in-progress pause into paused_ms, but only the portion inside
    // the (possibly back-dated) session window — a pause segment after
    // endedAtMs happened once the session was already over, so it must not
    // count. If the accumulated pause still exceeds the window it's implausible,
    // so drop it rather than record negative worked time.
    let pausedMs = row.paused_ms != null ? Number(row.paused_ms) : 0;
    if (row.paused_since) {
      pausedMs += Math.max(0, endedAtMs - new Date(row.paused_since).getTime());
    }
    if (pausedMs > endedAtMs - startedAtMs) pausedMs = 0;

    update.ended_at = new Date(endedAtMs).toISOString();
    update.paused_ms = pausedMs;
    update.paused_since = null;
    ended = true;
  } else if (
    row.paused_since &&
    startedAtMs >= new Date(row.paused_since).getTime()
  ) {
    // Still running: the corrected start now sits at/after an in-progress
    // pause, so that pause is dangling — keeping it would drive worked time
    // negative (and clamp to 0). Drop it; the session accrues from the new
    // start.
    update.paused_since = null;
  }

  const { error } = await supabase
    .from("sessions")
    .update(update)
    .eq("id", row.id);
  if (error) return { error: error.message };

  // When the edit ends the session the caller pushes to /clock/finish — same
  // guard concern as clockOut. Still running → full (layout) revalidation so
  // the live page and nav ticker pick up the corrected start.
  if (ended) revalidateSessionSurfacesExceptLive();
  else revalidateSessionSurfaces();
  return { ok: true, sessionId: row.id, ended };
}

// Pause the active session: stamp paused_since so worked time stops
// accumulating. No-op if there's no active session or it's already paused.
export async function pauseSession(): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
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

  revalidateSessionSurfaces();
  return { ok: true };
}

// Resume the active session: bank the just-finished pause segment into
// paused_ms and clear paused_since. No-op if not currently paused.
export async function resumeSession(): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
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

  revalidateSessionSurfaces();
  return { ok: true };
}

type CreateSessionInput = {
  categoryId?: string | null;
  goalId?: string | null;
  taskName: string;
  description?: string;
  startedAt: number; // ms
  endedAt: number; // ms
  isPrivate?: boolean;
};

export async function createSession(input: CreateSessionInput): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const axis = resolveAxis(input.categoryId, input.goalId);
  if ("error" in axis) return axis;

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    category_id: axis.categoryId,
    goal_id: axis.goalId,
    task_name: capText(input.taskName, TASK_MAX),
    description: capText(input.description, SESSION_DESC_MAX),
    started_at: new Date(input.startedAt).toISOString(),
    ended_at: new Date(input.endedAt).toISOString(),
    is_private: input.isPrivate ?? false,
  });

  if (error) return { error: error.message };
  revalidateSessionSurfaces();
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
  // Social v2: true = owner-only, false = visible to accepted friends (Aspect 4).
  isPrivate?: boolean;
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
  if (patch.taskName !== undefined) {
    update.task_name = capText(patch.taskName, TASK_MAX);
  }
  if (patch.description !== undefined) {
    update.description = capText(patch.description, SESSION_DESC_MAX);
  }
  if (patch.startedAt !== undefined) {
    update.started_at = new Date(patch.startedAt).toISOString();
  }
  if (patch.endedAt !== undefined) {
    update.ended_at = patch.endedAt === null ? null : new Date(patch.endedAt).toISOString();
  }
  if (patch.isPrivate !== undefined) {
    update.is_private = patch.isPrivate;
  }

  const { error } = await supabase.from("sessions").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidateSessionSurfaces();
  return { ok: true };
}

export async function deleteSession(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateSessionSurfaces();
  return { ok: true };
}
