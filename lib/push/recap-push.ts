// WHAT the weekly-recap push says and where a tap lands — pure, so the copy is
// testable without touching APNs. Mirrors lib/push/nudge-push.ts; the
// orchestrator (lib/push/send-recap-push.ts) consumes this and lib/push/apns.ts
// sends it.
//
// Unlike the other two families this push is not ABOUT anyone — no sender, no
// comment, no goal title. Every string here is a constant, so there is nothing
// user-supplied that could reach a lock screen.
//
// The copy is deliberately generic: the candidate query does no emptiness
// check, so a user who tracked nothing this week still gets this push, and any
// body quoting hours would read "You logged 0h". Say the recap is ready and let
// the story itself do the talking.

export type RecapPushContent = {
  title: string;
  body: string;
  // In-app path a tap navigates to; rides in the push payload and is followed
  // by components/notification-tap-router.tsx.
  url: string;
};

export function composeRecapPush(input: {
  // YYYY-MM-DD Monday, from weekWindow(tz, …).weekStartISO.
  weekStartISO: string;
}): RecapPushContent {
  return {
    title: "Your week is ready",
    body: "See how the week came together.",
    // The V2 full-screen story, NOT the legacy /recap?w= card view. It stamps
    // markRecapOpened on mount, so tapping the push also clears the in-app
    // "Your week is ready" banner on Progress.
    url: `/recap/${input.weekStartISO}`,
  };
}

// The push_log primary key. Per user PER WEEK, not per user: the week is what
// makes this a new event, and the hourly cron re-runs across the whole Sunday
// evening window, so every run after the first must claim the same key and
// lose.
export function recapDedupeKey(userId: string, weekStartMs: number): string {
  return `recap:${userId}:${weekStartMs}`;
}

// apns-collapse-id: scoped to the week, so a retry can only ever replace the
// banner already on the lock screen. Must be <= 64 bytes; "recap-" plus a
// 13-digit epoch is 19.
export function recapCollapseId(weekStartMs: number): string {
  return `recap-${weekStartMs}`;
}
