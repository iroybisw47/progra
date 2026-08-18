// Product analytics events.
//
// A thin wrapper so call sites never import posthog-js directly and never have
// to care whether it loaded. Every function is safe on the server, safe before
// init, and safe when NEXT_PUBLIC_POSTHOG_KEY is unset — analytics must never
// be able to break a user action.
//
// Events are captured CLIENT-side at the point the user completes something,
// rather than server-side in the actions. Actions are called from several
// paths and some (autoClockOut, completePlannedSession) fire without the user
// doing anything, which would inflate the numbers.

// The event names, in one place so a typo can't silently create a second
// event that never shows up in a funnel. Chosen to answer the activation
// question — do people finish sessions, keep habits, and add friends in week
// one — rather than to be exhaustive.
export type AnalyticsEvent =
  | "session_completed"
  | "habit_checked"
  | "friend_added"
  | "invite_sent"
  | "onboarding_completed"
  // Notification permission. iOS grants it once, ever, so the grant rate at
  // each surface is the only signal available on whether the copy works —
  // there is no second attempt to learn from. `source` distinguishes them:
  // "onboarding" | "settings" | "live_timer".
  | "notification_permission_asked" // { source, result }
  | "notification_permission_skipped" // { source, state }
  | "notification_settings_opened" // { source, state }
  | "clock_reminders_toggled" // { enabled }
  | "habit_reminder_toggled" // { enabled }
  | "habit_reminder_time_changed"; // { time }

type Props = Record<string, string | number | boolean | null>;

async function client() {
  if (typeof window === "undefined") return null;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  try {
    const posthog = (await import("posthog-js")).default;
    return posthog.__loaded ? posthog : null;
  } catch {
    return null;
  }
}

export function track(event: AnalyticsEvent, props?: Props): void {
  void client().then((p) => p?.capture(event, props));
}

// NOTE: identify/reset deliberately do NOT live here.
//
// They ran through this same `client()` helper, which returns null unless
// posthog.__loaded is true — and identity has to happen immediately after
// init, where that flag may not be set yet. Routing it through here lost the
// race and dropped the identify silently.
//
// components/posthog-init.tsx now calls posthog.identify/reset directly, in
// the same sequenced block as init, so ordering is guaranteed by construction.
// A second entry point here would just reintroduce the race.
