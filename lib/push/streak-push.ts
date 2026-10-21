// WHAT the two streak pushes say and where a tap lands — pure, so the copy is
// testable without touching APNs. Mirrors lib/push/recap-push.ts; the
// orchestrator (lib/push/send-streak-push.ts) consumes this.
//
// Neither push is about anyone else: there is no friend push in streaks (the
// owner's call — if a streak is going to end, that's on its owner). The only
// variable is the person's own count, a number from the candidate RPC.
//
// Tone: never guilt. The reminder says the day is still open, not that
// something is about to be lost; the freeze push says the streak is safe.

export type StreakPushKind = "reminder" | "freeze";

export type StreakPushContent = {
  title: string;
  body: string;
  // In-app path a tap navigates to (components/notification-tap-router.tsx).
  url: string;
};

export function composeStreakPush(input: {
  kind: StreakPushKind;
  // The current streak as the RPC read it: through yesterday for a reminder,
  // and the bridged count for a freeze.
  current: number;
}): StreakPushContent {
  const days = `${input.current}-day`;
  if (input.kind === "reminder") {
    return {
      title: "Today’s still open",
      body: `Your ${days} streak is waiting on today. A session or a habit keeps it going.`,
      // Straight to clocking in: the quickest way to count the day.
      url: "/clock",
    };
  }
  return {
    title: "A freeze kept your streak going",
    body: `Yesterday was covered, so your ${days} streak is safe.`,
    // Your profile, where the badge and its sheet say how many are left.
    url: "/me",
  };
}

// The push_log primary key: per person, per kind, per streak day. The hourly
// cron re-runs across each window (three hours for the reminder, fourteen for
// the freeze), so every run after the first must claim the same key and lose.
export function streakDedupeKey(kind: StreakPushKind, userId: string, day: string): string {
  return `streak-${kind}:${userId}:${day}`;
}

// apns-collapse-id, scoped to the day: a retry can only replace the banner
// already on the lock screen. "streak-reminder-2026-10-21" is 26 bytes (<= 64).
export function streakCollapseId(kind: StreakPushKind, day: string): string {
  return `streak-${kind}-${day}`;
}

// How long APNs may hold each one for a phone that's off. The reminder must
// never land after the day has closed at 4am, and it goes out by 22:00, so two
// hours keeps it to the evening. A freeze note is fine at breakfast.
export function streakTtlSeconds(kind: StreakPushKind): number {
  return kind === "reminder" ? 2 * 60 * 60 : 12 * 60 * 60;
}
