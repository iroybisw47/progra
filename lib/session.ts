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
export function sessionWorkedMs(s: Session, now: number): number {
  const end = s.endedAt ?? now;
  const span = end - s.startedAt;
  const currentPause =
    s.pausedSince !== null ? Math.max(0, now - s.pausedSince) : 0;
  return Math.max(0, span - s.pausedMs - currentPause);
}

// Total paused time for a session, including any in-progress pause.
export function sessionPausedMs(s: Session, now: number): number {
  const currentPause =
    s.pausedSince !== null ? Math.max(0, now - s.pausedSince) : 0;
  return s.pausedMs + currentPause;
}

export function isPaused(s: Session): boolean {
  return s.endedAt === null && s.pausedSince !== null;
}
