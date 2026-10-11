// The BottomNav's one-shot rise as onboarding v3 hands off to the Clock tab
// (.claude/plans/onboarding-v3.md P7, R:152): Screen 6's "Start session" sets
// a flag in sessionStorage just before it navigates, and the nav rises from
// below the screen the first time it renders after that, consuming the flag.
// No flag, no rise: every other render of the nav is exactly what it was.
//
// A flag rather than a prop because nothing can hand the nav a prop at the
// moment it appears. It lives in the root layout, and on a first run it
// doesn't exist yet when the wizard leaves: the layout mounts it only once
// onboarded_at is set, which the Clock tab stamps on arrival
// (app/clock/finish-onboarding.tsx). On a replay it's mounted all along but
// renders nothing on /onboarding, and appears when the path changes.
// sessionStorage is per tab and outlives both the client navigation and the
// layout re-render in between.
//
// The flag holds the time it was set, which is the tap R:152 times the
// handoff from, and is honoured only within NAV_RISE_TTL_MS of it. If the nav
// never appears (the stamp failed, the app went to the background), a flag
// left behind mustn't make the nav jump on some unrelated page later in the
// session. The rise's 240ms delay counts from the tap too, so a nav that
// appears late rises at once instead of waiting 240ms more (lib/motion.ts
// navRiseAfter).
//
// A nav the server painted is never raised: the document loaded after the
// tap (a reload, or a push that fell back to a full load), so the bar is
// already on screen at rest, and snapping it down to rise would be the very
// jump the TTL exists to prevent (navRiseElapsed).
//
// Every storage access is wrapped: sessionStorage can be missing, or throw on
// access, in private modes and locked-down webviews. Without it there's
// simply no rise.

export const NAV_RISE_KEY = "progra.nav-rise";

// Longer than the slowest path from the tap to the nav appearing: the exit,
// the Clock page's load, then completeOnboarding's round trip on a first run.
export const NAV_RISE_TTL_MS = 15_000;

export type FlagStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// This tab's sessionStorage, or null where there is none (the server, or a
// browser that throws on the property itself).
export function sessionFlagStore(): FlagStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// Whether a stored flag still means "rise now". Pure, so the TTL rule is
// testable without a browser. Either side of `now`, since the clock can be
// adjusted between the tap and the nav's mount.
export function isFreshNavRise(stored: string | null, now: number): boolean {
  if (stored === null || stored.trim() === "") return false;
  const at = Number(stored);
  return Number.isFinite(at) && Math.abs(now - at) <= NAV_RISE_TTL_MS;
}

// Screen 6's half: ask the next nav to rise.
export function markNavRise(store: FlagStore | null, now: number): void {
  try {
    store?.setItem(NAV_RISE_KEY, String(now));
  } catch {
    // Quota or a locked store. The handoff works the same, without the rise.
  }
}

// The nav's half: when the tap was, if the nav should rise for it, or null.
// It consumes the flag either way, so one tap is one rise and a stale flag is
// cleared rather than left to linger.
export function takeNavRise(store: FlagStore | null, now: number): number | null {
  if (!store) return null;
  let stored: string | null;
  try {
    stored = store.getItem(NAV_RISE_KEY);
  } catch {
    return null;
  }
  if (stored === null) return null;
  try {
    store.removeItem(NAV_RISE_KEY);
  } catch {
    // Can't clear it. The TTL retires it instead.
  }
  return isFreshNavRise(stored, now) ? Number(stored) : null;
}

// How long ago the tap at `tappedAt` was, for a nav that took its flag at
// `now`, or null when the nav mustn't rise at all because the server painted
// it: `documentStart` (performance.timeOrigin) after the tap means this
// document loaded after it. Never negative, since the clock can move.
export function navRiseElapsed(tappedAt: number, now: number, documentStart: number): number | null {
  if (documentStart > tappedAt) return null;
  return Math.max(0, now - tappedAt);
}
