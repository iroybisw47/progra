import type { Session } from "@/lib/storage";

// Worked time for a session, excluding paused gaps. `startedAt`/`endedAt` are
// real wall-clock times; we subtract banked paused time plus any in-progress
// pause. For ended sessions `pausedSince` is always null, so this reduces to
// (end - start) - pausedMs. Existing pre-pause rows have pausedMs = 0 and
// pausedSince = null, so they read back as their original (end - start).
//
// This is the single source of truth for "how long did I actually work" —
// every aggregation (week card, recap, rollups, day breakdown) routes through
// it so worked-time numbers reconcile everywhere.
// Accepts just the timing fields so live surfaces (e.g. the "clocked in now"
// strip) can compute worked time from a minimal payload; full Session callers
// satisfy the Pick unchanged.
// `autoEndedAt` is OPTIONAL on purpose. Live surfaces (nav ticker, clocked-in
// strip, the running timer) build a minimal timing payload for a session that is
// by definition still active — and an active session can never be auto-ended, so
// omitting it is always correct there. Full Session objects carry the real value.
export type SessionTiming = Pick<
  Session,
  "startedAt" | "endedAt" | "pausedMs" | "pausedSince"
> &
  Partial<Pick<Session, "autoEndedAt">>;

// Hard cap on a single session's WORKED time (pauses excluded — a paused
// session freezes below the cap and can never trip it). Always on: no user
// setting, no preference column.
//
// NOTE: the `week_leaderboard` SECURITY DEFINER RPC re-implements worked-time
// math in SQL and carries this value as the literal 36000000. The two must
// move together or leaderboard ranks diverge from every other surface.
export const SESSION_CAP_MS = 10 * 60 * 60 * 1000;

// Uncapped worked time. Internal: the cap is a guardrail on *live* sessions,
// so it must not rewrite what an ended row already stores (see below).
function rawWorkedMs(s: SessionTiming, now: number): number {
  const end = s.endedAt ?? now;
  const span = end - s.startedAt;
  const currentPause =
    s.pausedSince !== null ? Math.max(0, now - s.pausedSince) : 0;
  return Math.max(0, span - s.pausedMs - currentPause);
}

export function sessionWorkedMs(s: SessionTiming, now: number): number {
  // A session the 10-hour cap ended counts as ZERO worked time — everywhere.
  // Hitting the cap means you forgot to clock out, so the hours aren't real and
  // shouldn't feed goals, recaps, rollups or the leaderboard. Enforcing it here
  // rather than per-surface is what keeps every number agreeing.
  //
  // Not punitive: the session still exists, and the finish screen's review flow
  // lets you delete it and re-add the real hours as a past session — which is an
  // ordinary row with no autoEndedAt, so it counts normally.
  //
  // Read-time rule, not a data rewrite: clearing auto_ended_at (or editing this
  // function) brings the time straight back.
  if (s.autoEndedAt != null) return 0;

  const worked = rawWorkedMs(s, now);
  // Clamp ACTIVE sessions only, so a running session freezes at the cap rather
  // than climbing while it waits for autoClockOut. Ended rows read back exactly
  // what's stored.
  return s.endedAt === null ? Math.min(worked, SESSION_CAP_MS) : worked;
}

// True when a running session has already banked the cap. Always false for an
// ended session (historical runaways stay as recorded) and false while paused
// under the cap (worked time is frozen, so it can't trip). It IS true for a
// session paused *after* crossing the cap — the offline case, where no client
// was open at the crossing instant.
export function isOverSessionCap(s: SessionTiming, now: number): boolean {
  return s.endedAt === null && rawWorkedMs(s, now) >= SESSION_CAP_MS;
}

// The wall-clock instant at which worked time reaches SESSION_CAP_MS — what
// autoClockOut stamps into ended_at. Invariant: an ended row built with this
// end reads back at exactly SESSION_CAP_MS, since
// (start + CAP + pausedMs) - start - pausedMs = CAP.
//
// Only banked `pausedMs` enters. An in-progress pause can only have begun
// AFTER the cap instant (worked time freezes while paused, so a paused session
// is over the cap only if it crossed before the pause started), which also
// proves sessionCapEndMs(s) <= pausedSince <= now whenever isOverSessionCap is
// true — so the stamped end is never in the future.
export function sessionCapEndMs(s: SessionTiming): number {
  return s.startedAt + SESSION_CAP_MS + s.pausedMs;
}

// The single instant a session's time is attributed to (lib/aggregate's
// bucketing rule). For an over-cap active session that's the instant
// autoClockOut will stamp, NOT `now` — so the day/week/month bucket the time
// lands in doesn't move when the write finally lands.
export function sessionAttributionEnd(s: SessionTiming, now: number): number {
  if (s.endedAt !== null) return s.endedAt;
  return isOverSessionCap(s, now) ? sessionCapEndMs(s) : now;
}

// ---------------------------------------------------------------------------
// Timed sessions: a work target, plus optional breaks at intervals.
//
// A session with `plannedWorkMs === null` is open-ended — every session that
// existed before this feature, and every one started with the flag off. All of
// the helpers below return null/false/0 for that case, so nothing downstream
// needs to branch on the mode.
//
// Two things make this fit the existing model rather than fight it:
//
//   1. A BREAK IS A PAUSE. Break time accrues into `pausedMs` exactly like a
//      manual pause, so sessionWorkedMs already excludes it and no aggregation
//      anywhere needs to learn about breaks. `onBreak` exists only to tell the
//      two apart in the UI (and to refuse a manual pause during a break).
//   2. THE TARGET IS WORKED TIME, not wall clock. So the instant a plan
//      completes moves later on its own as pauses and breaks accumulate —
//      there is no deadline to cache, recompute or reschedule.
// ---------------------------------------------------------------------------

export type SessionPlan = {
  // The work target in ms. null = open-ended.
  plannedWorkMs: number | null;
  // Work between breaks, and how long a break lasts. Both null = a target with
  // no breaks. They are set and cleared together.
  workIntervalMs: number | null;
  breakMs: number | null;
  // True while the current pause is a scheduled break rather than a manual one.
  onBreak: boolean;
  // How many breaks have started. Drives when the next one is due, so ending a
  // break early doesn't hand out a short work interval afterwards.
  breaksTaken: number;
};

// The wall-clock instant at which worked time reaches the target — what
// completePlannedSession stamps into ended_at.
//
// Same shape as sessionCapEndMs, and the same invariant: a row ended here reads
// back as EXACTLY plannedWorkMs, since
// (start + planned + paused) - start - paused = planned.
//
// Only banked `pausedMs` enters, matching sessionCapEndMs. An in-progress pause
// can only have begun after this instant (worked time freezes while paused, so
// a paused session has reached its target only if it did so before the pause
// started), which also proves the stamped end is never in the future.
export function plannedEndMs(s: SessionTiming, plannedWorkMs: number): number {
  return s.startedAt + plannedWorkMs + s.pausedMs;
}

// Has an ACTIVE session reached its target? False for open-ended sessions and
// for anything already ended — an ended row is whatever it recorded.
export function isPlanComplete(
  s: SessionTiming,
  plan: Pick<SessionPlan, "plannedWorkMs">,
  now: number
): boolean {
  if (plan.plannedWorkMs === null || s.endedAt !== null) return false;
  return rawWorkedMs(s, now) >= plan.plannedWorkMs;
}

// The worked-time boundary at which the next break falls due, or null when
// breaks aren't configured.
//
// Keyed off the COUNT of breaks taken rather than elapsed time, which is what
// makes "end break early" behave: worked time doesn't advance during a break,
// so the next boundary is still a full interval of actual work away.
export function nextBreakDueAtWorkedMs(plan: SessionPlan): number | null {
  if (plan.workIntervalMs === null || plan.breakMs === null) return null;
  return (plan.breaksTaken + 1) * plan.workIntervalMs;
}

// Should a break start right now?
export function isBreakDue(
  s: SessionTiming,
  plan: SessionPlan,
  now: number
): boolean {
  if (plan.onBreak || s.endedAt !== null) return false;
  const due = nextBreakDueAtWorkedMs(plan);
  if (due === null) return false;

  const worked = rawWorkedMs(s, now);
  // Never interrupt the run-in to the finish line: if the target is already met
  // the session is about to end, and a break there would be pure friction.
  if (plan.plannedWorkMs !== null && worked >= plan.plannedWorkMs) return false;
  return worked >= due;
}

// Time left in the current break, floored at zero. `pausedSince` IS the break's
// start instant — a break sets it exactly as a manual pause does — so no
// separate column is needed to time it.
export function breakRemainingMs(
  s: SessionTiming,
  plan: SessionPlan,
  now: number
): number {
  if (!plan.onBreak || plan.breakMs === null || s.pausedSince === null) return 0;
  return Math.max(0, plan.breakMs - (now - s.pausedSince));
}

// Total paused time for a session, including any in-progress pause.
export function sessionPausedMs(s: Session, now: number): number {
  const currentPause =
    s.pausedSince !== null ? Math.max(0, now - s.pausedSince) : 0;
  return s.pausedMs + currentPause;
}

export function isPaused(s: Pick<Session, "endedAt" | "pausedSince">): boolean {
  return s.endedAt === null && s.pausedSince !== null;
}
