import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/bottom-nav";
import { EnsureProfileSync } from "@/components/ensure-profile-sync";
import { EnsureSessionCap } from "@/components/ensure-session-cap";
import { PushRegistration } from "@/components/push-registration";
import { Toaster } from "@/components/ui/sonner";
import { EnsurePlanComplete } from "@/components/ensure-plan-complete";
import { PostHogInit } from "@/components/posthog-init";
import { SyncClockReminders } from "@/components/sync-clock-reminders";
import { PlanCompleteModal } from "@/components/v2/plan-complete-modal";
import {
  getActiveSession,
  getUnreviewedPlanComplete,
} from "@/lib/db/sessions";
import { getNavBadges } from "@/lib/db/notifications";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";

// PT Sans everywhere (Progra V2). One family for both body and headings; the
// serif/heading slot (--font-newsreader) is aliased to --font-hanken in
// globals.css. PT Sans ships 400/700 (+ italic 400); 500/600 utilities fall back
// to the nearest weight, matching the V2 prototype.
const ptSans = PT_Sans({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Progra",
  description: "Study-time tracker: set goals, clock in, build habits, and track progress with friends.",
  applicationName: "Progra",
  appleWebApp: {
    capable: true,
    title: "Progra",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14181f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The nav's center Clock button ticks the live worked time when a session is
  // running (V2). All three reads are null-safe when signed out (their own
  // user checks), so they fire in parallel instead of serializing on every
  // page; the auth read inside each is shared via cache(). The profile feeds
  // EnsureProfileSync's stored-timezone comparison (and is free on routes that
  // fetch it anyway).
  const [user, activeSession, profile, navBadges, planComplete] =
    await Promise.all([
      getOptionalUser(),
      getActiveSession(),
      getProfile(),
      getNavBadges(),
      // Null on the common path — the partial index makes it a cheap miss.
      getUnreviewedPlanComplete(),
    ]);
  return (
    <html lang="en" className={`${ptSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Analytics. Deliberately NOT gated on `user`: the signed-out landing
            and the invite pages are exactly where drop-off matters most. */}
        <PostHogInit />
        {user && (
          <BottomNav
            activeSession={
              activeSession
                ? {
                    startedAt: activeSession.startedAt,
                    endedAt: activeSession.endedAt,
                    pausedMs: activeSession.pausedMs,
                    pausedSince: activeSession.pausedSince,
                  }
                : null
            }
            initialFeedBadge={navBadges.feed}
            initialFriendsBadge={navBadges.friends}
          />
        )}
        {user && <EnsureProfileSync timezone={profile?.timezone ?? null} />}
        {/* Flat primitives, not a SessionTiming object: an object literal would
            be a fresh reference every render and re-run the effect (re-scheduling
            the cap timer) on every layout re-render. */}
        {user && (
          <EnsureSessionCap
            sessionId={activeSession?.id ?? null}
            startedAt={activeSession?.startedAt ?? null}
            pausedMs={activeSession?.pausedMs ?? null}
            pausedSince={activeSession?.pausedSince ?? null}
          />
        )}
        {/* Flat primitives here too, and for the same reason as the cap leaf:
            an object literal is a fresh reference every render and would
            re-schedule the completion timer on every layout re-render. */}
        {user && (
          <EnsurePlanComplete
            sessionId={activeSession?.id ?? null}
            startedAt={activeSession?.startedAt ?? null}
            pausedMs={activeSession?.pausedMs ?? null}
            pausedSince={activeSession?.pausedSince ?? null}
            plannedWorkMs={activeSession?.plannedWorkMs ?? null}
          />
        )}
        {/* Shown once, on the first load after a timed session finished while
            nobody was watching. Both of its buttons stamp plan_reviewed_at. */}
        {user && planComplete && (
          <PlanCompleteModal
            sessionId={planComplete.id}
            taskName={planComplete.taskName}
            workedMs={planComplete.workedMs}
          />
        )}
        {/* Flat primitives again: an object literal is a fresh reference every
            render and would re-sync the device's notification schedule on every
            layout render. Only these five are needed — clockReminders reads
            nothing else, and breaks arrive via pausedSince. */}
        {user && (
          <SyncClockReminders
            sessionId={activeSession?.id ?? null}
            startedAt={activeSession?.startedAt ?? null}
            pausedMs={activeSession?.pausedMs ?? null}
            pausedSince={activeSession?.pausedSince ?? null}
            plannedWorkMs={activeSession?.plannedWorkMs ?? null}
          />
        )}
        {/* Gated on `user`: the push token is stored against the current
            user, so there's nothing to save until someone is signed in.
            No-op on web. */}
        {user && <PushRegistration />}
        <Toaster />
      </body>
    </html>
  );
}
