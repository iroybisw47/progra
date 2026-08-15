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
export function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return; // Unset in an environment → analytics simply off.

    let cancelled = false;
    void (async () => {
      const posthog = (await import("posthog-js")).default;
      if (cancelled || posthog.__loaded) return;

      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",

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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
