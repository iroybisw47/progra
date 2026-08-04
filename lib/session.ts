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

// Total paused time for a session, including any in-progress pause.
export function sessionPausedMs(s: Session, now: number): number {
  const currentPause =
    s.pausedSince !== null ? Math.max(0, now - s.pausedSince) : 0;
  return s.pausedMs + currentPause;
}

export function isPaused(s: Pick<Session, "endedAt" | "pausedSince">): boolean {
  return s.endedAt === null && s.pausedSince !== null;
}
