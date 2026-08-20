"use server";

import {
  revalidateSessionSurfaces,
  revalidateSessionSurfacesExceptLive,
} from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/db/categories";
import { listHistoryPage, type HistoryItem } from "@/lib/db/history";
import {
  SESSION_CAP_MS,
  breakFitsTarget,
  isOverSessionCap,
  isPlanComplete,
  plannedEndMs,
  sessionCapEndMs,
  type SessionTiming,
} from "@/lib/session";
import { capText } from "@/lib/validate";
import { requireSeat } from "@/lib/auth/require-seat";

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
  // Timed sessions. Omit entirely for the open-ended session this app has
  // always had — that path writes none of these columns.
  plan?: {
    // Target WORK time. Breaks and pauses sit on top, so the wall clock runs
    // longer; the logged number is this one.
    plannedWorkMs: number;
    // Break config is all-or-nothing. Omit both for a target with no breaks.
    workIntervalMs?: number | null;
    breakMs?: number | null;
  };
};

// Validates and normalizes a clock-in plan into the columns it maps to.
//
// Clamping rather than rejecting on the target: the cap would end an over-long
// session at 10h anyway, so a larger number could never have been honoured. The
// UI shouldn't offer one — this is the backstop.
function resolvePlan(
  plan: ClockInInput["plan"]
):
  | {
      planned_work_ms: number | null;
      work_interval_ms: number | null;
      break_ms: number | null;
    }
  | { error: string } {
  if (!plan) {
    return { planned_work_ms: null, work_interval_ms: null, break_ms: null };
  }

  const target = Math.round(plan.plannedWorkMs);
  if (!Number.isFinite(target) || target <= 0) {
    return { error: "Pick how long you want to work" };
  }
  const planned = Math.min(target, SESSION_CAP_MS);

  const interval =
    plan.workIntervalMs != null ? Math.round(plan.workIntervalMs) : null;
  const brk = plan.breakMs != null ? Math.round(plan.breakMs) : null;

  // All-or-nothing: an interval with no break length (or vice versa) would
  // leave a half-configured schedule that can never fire correctly.
  if ((interval === null) !== (brk === null)) {
    return { error: "Set both a break length and how often" };
  }
  if (interval !== null && brk !== null) {
    if (interval <= 0 || brk <= 0) {
      return { error: "Break settings must be longer than zero" };
    }
    // A first break that lands at or past the finish line can never happen, so
    // reject it rather than silently recording breaks that never fire. Same
    // helper the clock-in picker greys presets out with, so the UI can't offer
    // a combination this rejects.
    if (!breakFitsTarget(interval, planned)) {
      return { error: "Breaks must come sooner than the end of the session" };
    }
  }

  return { planned_work_ms: planned, work_interval_ms: interval, break_ms: brk };
}

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
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const axis = resolveAxis(input.categoryId, input.goalId);
  if ("error" in axis) return axis;

  const plan = resolvePlan(input.plan);
  if ("error" in plan) return plan;

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
      // All null for an open-ended session, which is every caller today.
      ...plan,
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
// to the Finish & save screen for it. `draft: true` (the redesign flow) marks
// the ended session private so it stays hidden from friends until the finish
// screen's Post applies the chosen visibility — abandoning the screen leaves it
// saved but private. Callers with no compose step (legacy flow, onboarding)
// omit it and publish immediately, as before.
export async function clockOut(opts?: { draft?: boolean }): Promise<
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
      ...(opts?.draft ? { is_private: true } : {}),
    })
    .eq("id", row.id);

  if (error) return { error: error.message };

  // Caller navigates from /clock/live to /clock/finish next — don't re-render
  // the live page's redirect guard in this POST.
  revalidateSessionSurfacesExceptLive();
  return { ok: true, sessionId: row.id };
}

// The 10-hour cap's write half. Ends the caller's active session at the exact
// instant its worked time reached SESSION_CAP_MS, marks it private (the repo's
// draft convention) and stamps auto_ended_at so it can be surfaced for review.
//
// Takes NO arguments on purpose: the cap is recomputed here from the stored row
// and the server clock, so a wrong or hostile client clock can neither trigger
// an early clock-out nor suppress a due one. Idempotent and safe to call on
// every page load — under the cap (or paused under it, or no active session at
// all) it writes nothing. Triggered by <EnsureSessionCap/> in the root layout;
// there is no cron, so enforcement is lazy by design.
export async function autoClockOut(): Promise<
  | { ok: true; ended: false }
  | { ok: true; ended: true; sessionId: string }
  | { error: string }
> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data: active } = await supabase
    .from("sessions")
    .select("id, started_at, paused_ms, paused_since")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const row = active as {
    id: string;
    started_at: string;
    paused_ms: number | string | null;
    paused_since: string | null;
  } | null;
  if (!row) return { ok: true, ended: false };

  const timing: SessionTiming = {
    startedAt: new Date(row.started_at).getTime(),
    endedAt: null,
    // PostgREST returns bigint as string (mirrors rowToSession).
    pausedMs: row.paused_ms != null ? Number(row.paused_ms) : 0,
    pausedSince: row.paused_since
      ? new Date(row.paused_since).getTime()
      : null,
  };

  // Worked time, pauses excluded — so a session paused below the cap freezes
  // and is never auto-ended while it stays paused.
  if (!isOverSessionCap(timing, Date.now())) return { ok: true, ended: false };

  // The instant the cap was actually hit. Back-dated when the crossing happened
  // while the app was closed, so no time is invented and the row works out to
  // exactly SESSION_CAP_MS of worked time.
  const cappedEnd = sessionCapEndMs(timing);

  // paused_ms is written back UNCHANGED. An in-progress pause can only have
  // begun after cappedEnd (worked time freezes while paused), so that segment
  // sits entirely after the session was already over and must not count —
  // the same reasoning as editActiveSessionTime's out-of-window pause drop.
  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date(cappedEnd).toISOString(),
      paused_since: null,
      // Draft convention: draft == private. Nothing the user never composed
      // reaches the friend feed — they review and Post from /clock/finish.
      is_private: true,
      auto_ended_at: new Date(cappedEnd).toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", user.id)
    // Re-assert ended_at IS NULL so two tabs (or two devices) racing produce
    // exactly one write; the loser matches 0 rows and reports ended: false.
    .is("ended_at", null)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { ok: true, ended: false };

  // Full layout revalidation, unlike clockOut's ExceptLive variant: the session
  // is genuinely over, so /clock/live's `if (!active) redirect("/clock")` guard
  // SHOULD fire in this POST. There's no paired client push to protect here the
  // way Stop has, and it also un-ticks the nav FAB.
  revalidateSessionSurfaces();
  return { ok: true, ended: true, sessionId: row.id };
}

// Ends a timed session that has reached its work target.
//
// Mirrors autoClockOut in shape — no arguments, recomputes from the stored row
// and the SERVER clock, guarded so racing tabs produce one write — but differs
// in the one way that matters: it does NOT set auto_ended_at. That column makes
// sessionWorkedMs return zero, because hitting the 10-hour cap means you forgot
// to clock out. A completed plan is the opposite: time you set out to do and
// did, which must count in full toward goals, recaps, rollups and the
// leaderboard.
//
// Back-dates to the instant the target was actually reached, so a session that
// completed while the app was shut invents no time and lands in the right day.
export async function completePlannedSession(): Promise<
  | { ok: true; ended: false }
  | { ok: true; ended: true; sessionId: string }
  | { error: string }
> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data: active } = await supabase
    .from("sessions")
    .select("id, started_at, paused_ms, paused_since, planned_work_ms")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const row = active as {
    id: string;
    started_at: string;
    paused_ms: number | string | null;
    paused_since: string | null;
    planned_work_ms: number | string | null;
  } | null;
  if (!row || row.planned_work_ms == null) return { ok: true, ended: false };

  const timing: SessionTiming = {
    startedAt: new Date(row.started_at).getTime(),
    endedAt: null,
    // PostgREST returns bigint as string (mirrors rowToSession).
    pausedMs: row.paused_ms != null ? Number(row.paused_ms) : 0,
    pausedSince: row.paused_since ? new Date(row.paused_since).getTime() : null,
  };
  const plannedWorkMs = Number(row.planned_work_ms);

  if (!isPlanComplete(timing, { plannedWorkMs }, Date.now())) {
    return { ok: true, ended: false };
  }

  const end = plannedEndMs(timing, plannedWorkMs);

  // paused_ms written back UNCHANGED, and on_break cleared: as with the cap, an
  // in-progress pause can only have begun after the target was met, so that
  // segment sits entirely after the session was already over.
  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date(end).toISOString(),
      paused_since: null,
      on_break: false,
      // Draft convention: draft == private, so nothing the user never composed
      // reaches the feed. They review and Post from /clock/finish.
      is_private: true,
    })
    .eq("id", row.id)
    .eq("user_id", user.id)
    .is("ended_at", null)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { ok: true, ended: false };

  revalidateSessionSurfaces();
  return { ok: true, ended: true, sessionId: row.id };
}

// Drops the plan from the active session, turning it back into an ordinary
// open-ended one. Timing is untouched: worked time, breaks already taken and
// banked pauses all stay exactly as they are.
//
// This is what "Keep going" does when a target is reached. It has to clear the
// plan rather than merely skip the auto-end, because a timed session left
// running past its target is an incoherent state — the root-layout leaf would
// end it the moment the user navigated away, so the "undo" would undo nothing.
export async function clearSessionPlan(): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("sessions")
    .update({
      planned_work_ms: null,
      work_interval_ms: null,
      break_ms: null,
      // A break in progress stays a pause — dropping the plan must not silently
      // resume the clock. Only the "this pause is a break" label goes.
      on_break: false,
    })
    .eq("user_id", user.id)
    .is("ended_at", null);
  if (error) return { error: error.message };

  revalidateSessionSurfaces();
  return { ok: true };
}

// Dismisses the "your session finished" modal once it's been seen, so it can't
// reappear on another device. Mirrors markAutoEndReviewed.
export async function markPlanReviewed(id: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("sessions")
    .update({ plan_reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Session not found" };
  revalidateSessionSurfaces();
  return { ok: true };
}

// Dismisses the auto-end review nudge once the user has seen the session.
export async function markAutoEndReviewed(id: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("sessions")
    .update({ auto_end_reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Session not found" };
  revalidateSessionSurfaces();
  return { ok: true };
}

// Correct an active session's start (and optionally end it at a chosen time) —
// the Edit-time control on the live timer, for when you forgot to clock out.
// Passing endedAtMs finalizes the session (settling any in-progress pause);
// null leaves it running with the corrected start. `draft` matches clockOut:
// when the edit ends the session, mark it private so the finish screen's Post
// controls publication.
export async function editActiveSessionTime(input: {
  startedAtMs: number;
  endedAtMs: number | null;
  draft?: boolean;
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
    if (input.draft) update.is_private = true;
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
    .select("id, paused_since, on_break")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const row = active as {
    id: string;
    paused_since: string | null;
    on_break: boolean | null;
  } | null;
  if (!row) return { error: "No active session" };
  // A break is already a pause, and the two mean different things to the timer.
  // Stopping for longer means ending the break first — enforced here and not
  // just by hiding the button, since an action is reachable directly.
  if (row.on_break) {
    return { error: "End the break first, then pause" };
  }
  if (row.paused_since) return { ok: true }; // already paused

  const { error } = await supabase
    .from("sessions")
    .update({ paused_since: new Date().toISOString() })
    .eq("id", row.id);
  if (error) return { error: error.message };

  revalidateSessionSurfaces();
  return { ok: true };
}

// Start a scheduled break. A break IS a pause — it stamps paused_since exactly
// as pauseSession does, so worked time stops and every aggregation downstream
// excludes it for free. `on_break` is what distinguishes the two, and
// breaks_taken is what makes the NEXT break land a full interval later even if
// this one is ended early.
export async function startBreak(): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data: active } = await supabase
    .from("sessions")
    .select("id, paused_since, breaks_taken")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const row = active as {
    id: string;
    paused_since: string | null;
    breaks_taken: number | string | null;
  } | null;
  if (!row) return { error: "No active session" };
  // Already paused (manually or on a break) — nothing to start.
  if (row.paused_since) return { ok: true };

  const taken = row.breaks_taken != null ? Number(row.breaks_taken) : 0;

  const { error } = await supabase
    .from("sessions")
    .update({
      paused_since: new Date().toISOString(),
      on_break: true,
      breaks_taken: taken + 1,
    })
    .eq("id", row.id)
    // Re-assert not-paused so two tabs crossing the boundary together produce
    // exactly one break rather than double-counting breaks_taken.
    .is("paused_since", null);
  if (error) return { error: error.message };

  revalidateSessionSurfaces();
  return { ok: true };
}

// End a break — whether it ran its course or the user cut it short. Both are
// the same write, which is why "End break early" needs no separate path: bank
// the elapsed break into paused_ms exactly as resumeSession banks a pause.
export async function endBreak(): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data: active } = await supabase
    .from("sessions")
    .select("id, paused_ms, paused_since, on_break")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  const row = active as {
    id: string;
    paused_ms: number | string | null;
    paused_since: string | null;
    on_break: boolean | null;
  } | null;
  if (!row) return { error: "No active session" };
  if (!row.on_break || !row.paused_since) return { ok: true }; // not on a break

  const banked = row.paused_ms != null ? Number(row.paused_ms) : 0;
  const pausedMs =
    banked + Math.max(0, Date.now() - new Date(row.paused_since).getTime());

  const { error } = await supabase
    .from("sessions")
    .update({ paused_ms: pausedMs, paused_since: null, on_break: false })
    .eq("id", row.id)
    .eq("on_break", true);
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
  const seat = await requireSeat();
  if ("error" in seat) return seat;

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
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

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

  // Explicit ownership filter + row check: RLS already blocks foreign writes,
  // but a 0-row update returns no error, so a stale/spoofed id would otherwise
  // report a false success (matters now that /clock/finish drives these via
  // ?sid). Mirrors uploadSessionPhoto's explicit-ownership pattern.
  const { data, error } = await supabase
    .from("sessions")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Session not found" };
  revalidateSessionSurfaces();
  return { ok: true };
}

export async function deleteSession(id: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Session not found" };
  revalidateSessionSurfaces();
  return { ok: true };
}
