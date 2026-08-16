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
  | "onboarding_completed";

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
