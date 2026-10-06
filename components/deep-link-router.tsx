"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { appPlugin } from "@/lib/native-plugins";

// Where a custom-scheme deep link lands.
//
// THE GAP THIS FILLS: Capacitor does NOT navigate the webview when the app is
// opened via world.progra.app://… — it fires the App plugin's `appUrlOpen` event
// and does nothing else. Nothing in this app was listening, so until now a deep
// link only foregrounded the app on whatever it happened to be showing, and a
// cold launch landed on Home. (There is no route restoration: lib/last-route.ts
// is in-memory and only feeds bug-report attribution.)
//
// That makes this a prerequisite for the Live Activity rather than a nicety.
// Phase 1 needs it for "tap the card to open the timer"; Phase 2 needs it for the
// fallback that runs when a Lock Screen button can't authenticate silently.
//
// Its own leaf rather than living inside SyncLiveActivity, the same reasoning
// NotificationTapRouter gives for itself: inside a flag-gated sync component it
// would die with the flag, taking all deep-link routing with it. Deep links are
// not Live-Activity-specific.
export function DeepLinkRouter() {
  const router = useRouter();

  useEffect(() => {
    let handle: { remove: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        // Off the Capacitor global — see lib/native-plugins.ts for why neither
        // import form works on device. Null on web, nothing to attach.
        const app = appPlugin();
        if (!app) return;

        // WARM open: the app is already running and JS is listening.
        const h = await app.addListener("appUrlOpen", (data) =>
          go(router, data.url)
        );
        if (cancelled) {
          h.remove();
          return;
        }
        handle = h;

        // COLD launch: the URL existed before any of this was mounted, so the
        // event has already come and gone. Read it once instead.
        //
        // Guarded at module scope rather than by a ref, for the same reason
        // ensure-session-cap.tsx keeps `attemptedFor` there: a client-side
        // navigation remounts this leaf, and getLaunchUrl keeps returning the
        // same URL for the life of the process — so a ref would re-navigate on
        // every remount, yanking the user back to the timer.
        if (!handledLaunchUrl) {
          handledLaunchUrl = true;
          const launch = await app.getLaunchUrl();
          if (!cancelled && launch?.url) go(router, launch.url);
        }
      } catch {
        // Web, or the plugin is unavailable. Nothing to attach.
      }
    })();

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [router]);

  return null;
}

// Module scope — survives the remounts a client-side navigation causes. See the
// comment at the call site.
let handledLaunchUrl = false;

// Same allowlist discipline as notification-tap-router.tsx: only a same-origin
// path is followed, and anything else lands on Home, because the open has to go
// SOMEWHERE. Protocol-relative ("//evil.com") is rejected explicitly — it would
// otherwise pass a bare startsWith("/").
function go(router: { push: (href: string) => void }, raw: string): void {
  router.push(samePath(raw) ?? "/");
}

function samePath(raw: string): string | null {
  // world.progra.app:///clock/live?la=end → "/clock/live?la=end". Parsed rather
  // than string-sliced so a host-bearing variant (world.progra.app://evil/x)
  // can't smuggle a path through.
  let path: string;
  try {
    const u = new URL(raw);
    path = `${u.pathname}${u.search}`;
  } catch {
    // Not a URL at all — treat it as a bare path and let the checks below rule.
    path = raw;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}
