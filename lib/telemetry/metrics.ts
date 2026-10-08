// The dashboard's definitions, as pure functions. The admin RPCs in
// .claude/plans/analytics/phase4.sql compute everything in SQL; these are the
// REFERENCE implementations the harness feeds the same fixtures to, so a
// definition can only change in both places at once (lib/telemetry/
// metrics.test.ts pins the TypeScript side; nudges-harness/analytics-phase4.mjs
// pins SQL == TypeScript).
//
// Every instant is epoch ms; every "day" is a YYYY-MM-DD string in the user's
// own timezone, produced by the caller. No Date.now() in here.

import { SESSION_CAP_MS } from "@/lib/session";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

// --- the four states and the ghost overlay -----------------------------------

export type UserState = "not_onboarded" | "never_logged" | "active" | "lapsed";

// Mutually exclusive and exhaustive:
//   not onboarded                      → onboarded_at is null
//   onboarded, never logged            → no log ever
//   active                             → a log in the last 7 days (rolling)
//   lapsed                             → logged before, nothing in 7+ days
export function userState(input: {
  onboardedAt: number | null;
  lastLoggedAt: number | null;
  now: number;
}): UserState {
  if (input.onboardedAt === null) return "not_onboarded";
  if (input.lastLoggedAt === null) return "never_logged";
  return input.now - input.lastLoggedAt < WEEK_MS ? "active" : "lapsed";
}

// Ghost: onboarded, opened the app at least once in the last 7 days, logged
// nothing in the last 7 days. An overlay, not a fifth state — a ghost is a
// never_logged or lapsed user who keeps opening the app.
export function isGhost(input: {
  onboardedAt: number | null;
  lastOpenedAt: number | null;
  lastLoggedAt: number | null;
  now: number;
}): boolean {
  if (input.onboardedAt === null) return false;
  if (input.lastOpenedAt === null || input.now - input.lastOpenedAt >= WEEK_MS) return false;
  return input.lastLoggedAt === null || input.now - input.lastLoggedAt >= WEEK_MS;
}

// --- activation ------------------------------------------------------------

export const ACTIVATION_FRIENDS = 3;
export const ACTIVATION_DAYS = 3;

// Peer friends accepted within the first 7 days after signup. `acceptedAts`
// already excludes internal accounts (the SQL does that join).
export function friendsInFirstWeek(signedUpAt: number, acceptedAts: readonly number[]): number {
  const deadline = signedUpAt + WEEK_MS;
  return acceptedAts.filter((at) => at >= signedUpAt && at < deadline).length;
}

// Distinct local days with a log, among the 7 local days starting on the
// signup day. `loggedDays` are YYYY-MM-DD strings in the user's timezone.
export function loggedDaysInFirstWeek(signupDay: string, loggedDays: readonly string[]): number {
  const end = addDays(signupDay, 7);
  return new Set(loggedDays.filter((d) => d >= signupDay && d < end)).size;
}

// 3+ mutual friends AND 3+ distinct logged days, both inside the first 7 days.
export function isActivated(input: { friendsInFirstWeek: number; loggedDaysInFirstWeek: number }): boolean {
  return (
    input.friendsInFirstWeek >= ACTIVATION_FRIENDS &&
    input.loggedDaysInFirstWeek >= ACTIVATION_DAYS
  );
}

// --- worked time, clipped to a window ----------------------------------------

export type WorkedInput = {
  startedAt: number;
  endedAt: number | null;
  pausedMs: number;
  pausedSince: number | null;
  autoEndedAt: number | null;
};

// sessionWorkedMs' rule (lib/session.ts), restated so the SQL mirror has one
// line to match: auto-ended ⇒ 0; otherwise span minus banked pause minus the
// pause in progress; a RUNNING session is capped at 10h, an ended one reads
// back exactly what it stored.
export function workedMs(s: WorkedInput, now: number): number {
  if (s.autoEndedAt !== null) return 0;
  const end = s.endedAt ?? now;
  const current = s.pausedSince !== null ? Math.max(0, now - s.pausedSince) : 0;
  const raw = Math.max(0, end - s.startedAt - s.pausedMs - current);
  return s.endedAt === null ? Math.min(raw, SESSION_CAP_MS) : raw;
}

// Worked time inside [windowStart, windowEnd). PROPORTIONAL clipping: the
// pauses are not timestamped individually (only their total is stored), so
// the part of the session's worked time that falls in the window is assumed
// to be the same share as the part of its wall-clock span that does. A
// session wholly inside the window is unchanged; one wholly outside is 0.
export function clippedWorkedMs(
  s: WorkedInput,
  windowStart: number,
  windowEnd: number,
  now: number
): number {
  const worked = workedMs(s, now);
  if (worked === 0) return 0;
  const end = s.endedAt ?? now;
  const span = end - s.startedAt;
  if (span <= 0) return 0;
  const overlap = Math.max(0, Math.min(end, windowEnd) - Math.max(s.startedAt, windowStart));
  if (overlap <= 0) return 0;
  if (overlap >= span) return worked;
  return Math.round((worked * overlap) / span);
}

// --- small helpers ---------------------------------------------------------

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + n * DAY_MS;
  const r = new Date(t);
  return `${r.getUTCFullYear()}-${String(r.getUTCMonth() + 1).padStart(2, "0")}-${String(r.getUTCDate()).padStart(2, "0")}`;
}

export type FriendBucket = "0" | "1" | "2" | "3-4" | "5-9" | "10+";

export function friendBucket(n: number): FriendBucket {
  if (n <= 0) return "0";
  if (n === 1) return "1";
  if (n === 2) return "2";
  if (n <= 4) return "3-4";
  if (n <= 9) return "5-9";
  return "10+";
}
