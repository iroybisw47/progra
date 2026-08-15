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

// Ties subsequent events to a person, and back-fills the anonymous events from
// before sign-in — which is what makes a signup funnel work at all.
//
// Username rather than email: it's already public in the app (public_profiles),
// so it makes people findable in the PostHog UI without escalating what's
// collected. Email would be a genuine step up in personal data for no analytic
// gain.
export function identifyUser(userId: string, username: string | null): void {
  void client().then((p) =>
    p?.identify(userId, username ? { username } : undefined)
  );
}

// MUST run on sign-out. Without it PostHog keeps attributing events to the
// previous person, so a shared device merges two people into one profile and
// the retention numbers quietly become fiction.
export function resetUser(): void {
  void client().then((p) => p?.reset());
}
