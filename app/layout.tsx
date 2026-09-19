import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/bottom-nav";
import { EnsureProfileSync } from "@/components/ensure-profile-sync";
import { EnsureSessionCap } from "@/components/ensure-session-cap";
import { PushRegistration } from "@/components/push-registration";
import { Toaster } from "@/components/ui/sonner";
import { EnsurePlanComplete } from "@/components/ensure-plan-complete";
import { PostHogInit } from "@/components/posthog-init";
import { NotificationTapRouter } from "@/components/notification-tap-router";
import { RouteMemory } from "@/components/route-memory";
import { LastSeenPing } from "@/components/last-seen-ping";
import { NotificationLifecycle } from "@/components/notification-lifecycle";
import { SyncClockReminders } from "@/components/sync-clock-reminders";
import { SyncHabitReminders } from "@/components/sync-habit-reminders";
import { PlanCompleteModal } from "@/components/v2/plan-complete-modal";
import { WhatsNewModal } from "@/components/v2/whats-new-modal";
import {
  getActiveSession,
  getUnreviewedPlanComplete,
} from "@/lib/db/sessions";
import { getHabitReminderData } from "@/lib/db/habits";
import { getNavBadges } from "@/lib/db/notifications";
import { HABIT_REMINDERS } from "@/lib/flags";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { patchNoteToShow } from "@/lib/patch-notes";
import { isWaitlisted } from "@/lib/auth/seat";
import { createClient } from "@/lib/supabase/server";
import { BetaFull } from "@/components/beta-full";

// Two families, as the redesign specifies: Hanken Grotesk for all UI text,
// Newsreader (serif) for headings and the big display numbers. Both are
// variable fonts, so no `weight` list — the whole 400–700 range ships in one
// file and 500/600 render as designed rather than snapping to a nearest cut.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
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
  // One colour, unconditionally: Progra has no dark mode, so advertising a dark
  // theme-color made iOS tint the status bar for a palette the app never renders.
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // No user zoom — and this is the half of the pinch-zoom fix that actually
  // reaches the installed apps, because the iOS shell is a thin webview over
  // this URL (capacitor.config.ts `server.url`), so it ships on a normal deploy
  // with no App Store round trip.
  //
  // What it defuses: Capacitor ships zoom "disabled" (CAPInstanceDescriptor.m:40,
  // `_zoomingEnabled = NO`), which makes CAPBridgeViewController.swift:322-324
  // install Capacitor as the scroll view's delegate — and that delegate's ENTIRE
  // zoom handling is WebViewDelegationHandler.swift:337-340:
  //     scrollViewWillBeginZooming { scrollView.pinchGestureRecognizer?.isEnabled = false }
  // That callback fires AFTER a scale is already applied, so it freezes the page
  // mid-zoom, and `pinchGestureRecognizer` appears exactly once in all of
  // Capacitor iOS — nothing re-enables it. The page is then stuck zoomed for the
  // webview's lifetime. With no pinch possible, that handler never runs.
  //
  // It also suppresses iOS's automatic zoom when a sub-16px input takes focus —
  // which matters more than it looks: UIScrollView fires the same
  // scrollViewWillBeginZooming for PROGRAMMATIC zoom, so a small field may have
  // been killing the recognizer before anyone pinched at all.
  //
  // WKWebView honours these limits (Capacitor never sets
  // `ignoresViewportScaleLimits`); iOS Safari deliberately ignores them, so
  // progra.world in a browser tab stays zoomable and only the app gives up user
  // zoom. That accessibility cost is deliberate — see buglist.md.
  maximumScale: 1,
  userScalable: false,
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
  const [user, activeSession, profile, navBadges, planComplete, habitData] =
    await Promise.all([
      getOptionalUser(),
      getActiveSession(),
      getProfile(),
      getNavBadges(),
      // Null on the common path — the partial index makes it a cheap miss.
      getUnreviewedPlanComplete(),
      // Feeds the habit-reminder sync leaf. It awaits getProfile internally
      // (cache()'d, shared with the read above), so it can sit here without
      // serializing the others. Skipped entirely while the flag is dark.
      HABIT_REMINDERS ? getHabitReminderData() : Promise.resolve(null),
    ]);

  // Free: the profile is already read above. `undefined` (the column doesn't
  // exist yet) deliberately yields null — see patchNoteToShow.
  const patchNote = patchNoteToShow(profile?.patch_notes_seen_version);

  // The 250-seat beta cap. Only the seat-less path costs anything: getProfile()
  // is already fetched above, so members pay nothing here.
  let waitlistPosition: number | null = null;
  let betaFull = false;
  if (isWaitlisted(profile)) {
    const supabase = await createClient();
    // Lazy promotion: retry the claim in case the cap was raised. There is no
    // cron in this repo, so admission is enforced on load — the same
    // shape as EnsureSessionCap.
    const { data: seat } = await supabase.rpc("claim_beta_seat_self");
    if (seat == null) {
      betaFull = true;
      const { data: position } = await supabase.rpc("beta_waitlist_position");
      waitlistPosition = typeof position === "number" ? position : null;
    }
    // Seat just granted — fall through and render the app normally. The
    // profile read above is now stale, but nothing downstream reads seat_no.
  }

  if (betaFull) {
    // No children, no BottomNav, no session/push leaves — a waitlisted user
    // gets no app shell at all. PostHogInit stays: hitting the wall is exactly
    // the drop-off worth measuring.
    return (
      <Shell userId={user?.id ?? null}>
        <BetaFull position={waitlistPosition} />
        <PostHogInit
          userId={user?.id ?? null}
          username={profile?.username ?? null}
          signupDate={profile?.created_at ?? null}
        />
        <Toaster />
      </Shell>
    );
  }

  return (
    <Shell userId={user?.id ?? null}>
      {children}
      {/* Analytics. Deliberately NOT gated on `user`: the signed-out landing
          and the invite pages are exactly where drop-off matters most. */}
      <PostHogInit
        userId={user?.id ?? null}
        username={profile?.username ?? null}
        signupDate={profile?.created_at ?? null}
      />
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
      {/* One release note, once. Three gates beyond `user`, all free:
          · onboarded_at — nobody is interrupted mid-wizard, and the decision is
            baked into THIS payload. completeOnboarding revalidates the page, not
            the layout, and onboarding then pushes to "/" — so the layout the
            browser is still holding could otherwise leak the note to a brand-new
            account. A path check in the leaf can only fail open; this fails closed.
          · !planComplete — that modal outranks this one (it's about the user's
            own data and carries a CTA), and two Base UI dialogs would stack two
            backdrops and fight over the focus trap. Yielding costs nothing:
            suppressing doesn't stamp, so the note waits for the next load.
          · patchNote — null when there's nothing to announce, or when the column
            doesn't exist yet.
          No next/dynamic, matching PlanCompleteModal: a client component imported
          by a SERVER component is already its own chunk, fetched only when the
          payload actually contains it — once per user per release. */}
      {user && profile?.onboarded_at != null && !planComplete && patchNote && (
        <WhatsNewModal
          version={patchNote.version}
          title={patchNote.title}
          intro={patchNote.intro}
          items={patchNote.items}
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
      {/* Same flat-primitives rule as the clock leaf: the name lists ride
          in as "\n"-joined strings, so the effect re-runs only when the
          habit data actually changes. Habit toggles reach it because
          revalidateHabitSurfaces revalidates the layout. */}
      {user && (
        <SyncHabitReminders
          uncheckedNames={habitData?.uncheckedNames.join("\n") ?? ""}
          activeNames={habitData?.activeNames.join("\n") ?? ""}
          statusDate={habitData?.statusDate ?? null}
        />
      )}
      {/* One listener for every notification family — routes a tap by its
          reserved id. Lives outside the sync leaves so it survives either
          flag being off. */}
      {user && <NotificationTapRouter />}
      {/* Gated on `user`: the push token is stored against the current
          user, so there's nothing to save until someone is signed in.
          No-op on web. */}
      {user && <PushRegistration />}
      {/* Remembers the previous route so a bug report filed from /settings can
          name the screen the bug actually happened on. Renders nothing. */}
      {user && <RouteMemory />}
      {/* "Last opened" for the admin analytics roster. Normal branch only: a
          waitlisted user can't use the app, so there's nothing to measure. */}
      {user && <LastSeenPing />}
      <Toaster />
    </Shell>
  );
}

// One definition of the html/body chrome, shared by the app tree and the
// beta-full wall so the two can never drift on fonts or layout.
function Shell({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | null;
}) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Ungated on purpose: a leaf gated on `user` can never observe user
            becoming null, which is the event it exists to catch. Living in
            Shell means the beta-full wall gets it too. */}
        <NotificationLifecycle userId={userId} />
      </body>
    </html>
  );
}
