"use client";

import { useEffect } from "react";

// Product analytics. Mounted once in the root layout, alongside the other
// client leaves (EnsureProfileSync, PushRegistration, SyncClockReminders).
//
// The key is a PostHog *project* key: write-only and designed to ship in client
// code, so NEXT_PUBLIC_ is correct. It still lives in an env var rather than
// the source so it isn't baked into the repo and can differ per environment.
//
// Init runs in an effect rather than at module scope. Module-scope init would
// execute during SSR (where `window` doesn't exist) and again on hydration; an
// effect is client-only and runs once, which is what posthog.init expects.
export function PostHogInit({
  userId,
  username,
  signupDate,
}: {
  userId: string | null;
  username: string | null;
  signupDate: string | null;
}) {
  // ONE effect, init then identity, in that order.
  //
  // These were two effects and it was a real bug: identify() bails out unless
  // posthog.__loaded is true, init is async (dynamic import, then init), and on
  // first load the identity effect won the race — so identify silently dropped.
  // The lastIdentified guard was set anyway, so it never retried, and every
  // session would have looked like a fresh anonymous person. Retention data
  // built on that is worse than none, because it looks plausible.
  //
  // Sequencing them here removes the race by construction rather than by luck.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return; // Unset in an environment → analytics simply off.

    let cancelled = false;
    void (async () => {
      const posthog = (await import("posthog-js")).default;
      if (cancelled) return;

      if (!posthog.__loaded) {
        posthog.init(key, {
        // Same-origin, proxied by the /ingest rewrite in next.config.ts, so
        // blockers that filter *.i.posthog.com by hostname don't drop events.
        // Relative on purpose: it resolves to progra.world inside the iOS
        // shell exactly as it does on the web.
        api_host: "/ingest",
        // Links in the PostHog toolbar still need the real host.
        ui_host: "https://us.posthog.com",

        // Anonymous events cost nothing and create no person record. A profile
        // is only made if something calls posthog.identify() — nothing does
        // yet, deliberately: see the note below.
        person_profiles: "identified_only",

        // App Router does client-side navigation, so the browser never fires a
        // fresh page load and the default one-shot pageview would only ever
        // record the entry point. 'history_change' hooks the History API, which
        // is what Next actually uses to navigate.
        //
        // This also avoids the usual workaround — useSearchParams() in a root
        // component — which opts routes into client rendering unless carefully
        // wrapped in Suspense.
        capture_pageview: "history_change",

        // Session replay records the screen. This app shows session notes,
        // friends' names and habit lists, so replay would capture other
        // people's content, not just this user's. Off unless deliberately
        // turned on, and turning it on is a privacy-policy decision rather
        // than a config one.
          disable_session_recording: true,
        });
      }

      if (cancelled) return;

      // Identity, only ever AFTER init has run on this client.
      //
      // Sign-out needs no explicit hook: /auth/signout is a server route with
      // no client code, but afterwards the layout re-renders with no user,
      // userId arrives null, and the reset happens here.
      if (userId) {
        if (lastIdentified === userId) return;
        posthog.identify(userId, {
          // Both are already public in the app (public_profiles), so they make
          // people findable in the PostHog UI without escalating what's
          // collected. signup_date is what lets cohorts be built by join week.
          ...(username ? { username } : {}),
          ...(signupDate ? { signup_date: signupDate } : {}),
        });
        // Set only AFTER the call, so a failure before this point retries on
        // the next render rather than being permanently skipped.
        lastIdentified = userId;
        return;
      }
      if (lastIdentified !== null) {
        posthog.reset();
        lastIdentified = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, username, signupDate]);

  return null;
}

// Module scope, not state: this must survive the remounts a client-side
// navigation causes, or every navigation would re-identify.
let lastIdentified: string | null = null;
