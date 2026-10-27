import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/bottom-nav";
import { EnsureProfileSync } from "@/components/ensure-profile-sync";
import { EnsureSessionCap } from "@/components/ensure-session-cap";
import { PushRegistration } from "@/components/push-registration";
import { Toaster } from "@/components/ui/sonner";
import { EnsurePlanComplete } from "@/components/ensure-plan-complete";
import { DeepLinkRouter } from "@/components/deep-link-router";
import { NotificationTapRouter } from "@/components/notification-tap-router";
import { RouteMemory } from "@/components/route-memory";
import { NotificationLifecycle } from "@/components/notification-lifecycle";
import { AnalyticsLifecycle } from "@/components/analytics-lifecycle";
import { SyncClockReminders } from "@/components/sync-clock-reminders";
import { SyncLiveActivity } from "@/components/sync-live-activity";
import { SyncAppearance } from "@/components/sync-appearance";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import {
  resolveAttribution,
  resolveAttributionColor,
} from "@/lib/session-attribution";
import { ClearHabitReminders } from "@/components/clear-habit-reminders";
import { PlanCompleteModal } from "@/components/v2/plan-complete-modal";
import { WhatsNewModal } from "@/components/v2/whats-new-modal";
import { UwPromptOnLoad } from "@/components/v2/uw-prompt-on-load";
import { SurveyModal } from "@/components/v2/survey-modal";
import {
  getActiveSession,
  getUnreviewedPlanComplete,
} from "@/lib/db/sessions";
import { getNavBadges } from "@/lib/db/notifications";
import { listMySurveyAnswers } from "@/lib/db/survey";
import {
  DARK_MODE,
  FRIENDS_V3,
  LIVE_ACTIVITY,
  UW,
} from "@/lib/flags";
import { APPEARANCE_SCRIPT, THEME_COLOR } from "@/lib/appearance";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { patchNoteToShow } from "@/lib/patch-notes";
import { uwPromptFor } from "@/lib/uw-prompt";
import { SURVEY, firstUnanswered, surveyOwed } from "@/lib/survey";
import { isWaitlisted } from "@/lib/auth/seat";
import { createClient } from "@/lib/supabase/server";
import { BetaFull } from "@/components/beta-full";

// Two families, as the redesign specifies: Hanken Grotesk for all UI text,
// Newsreader (serif) for headings and the big display numbers. Both are
// variable fonts, so no `weight` list — the whole 400–700 range ships in one
// file and 500/600 render as designed rather than snapping to a nearest cut.
//
// Newsreader also loads its optical-size axis (`opsz`, 6–72), which the
// designs assume: the browser's default `font-optical-sizing: auto` then cuts
// each size its own way, tighter at display sizes. Without it every serif
// line rendered at the 16px cut, ~4% wider than the handoffs (a 64px "Ready?"
// 11px wider, a 25px caption wrapping onto an extra line). Costs a somewhat
// larger font file; chosen by the owner on 2026-10-09.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
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
  // The screen ground for each theme. With DARK_MODE off there is only the
  // light one: advertising a dark theme-color made iOS tint the status bar for
  // a palette the app didn't render. With it on, the media pair covers
  // "System", and the head script (lib/appearance.ts) rewrites both when a
  // manual Light or Dark disagrees with the phone.
  themeColor: DARK_MODE
    ? [
        { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
        { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
      ]
    : THEME_COLOR.light,
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
  const [user, activeSession, profile, navBadges, planComplete] =
    await Promise.all([
      getOptionalUser(),
      getActiveSession(),
      getProfile(),
      getNavBadges(),
      // Null on the common path — the partial index makes it a cheap miss.
      getUnreviewedPlanComplete(),
    ]);

  // The Live Activity card names what the session counts towards and paints it
  // in the session's own colour, so it needs the goal/category lists the live
  // screen already resolves against.
  //
  // CONDITIONAL on purpose. Both reads are cache()-wrapped, so on the routes
  // that already use them (/, /clock, /clock/live, /goals) this is free — but on
  // /feed or /me it would be two extra queries on EVERY render. Gating on an
  // active session means the overwhelmingly common case (nobody clocked in) pays
  // nothing, and the cost only lands while a card actually exists. Skipped
  // entirely while the flag is dark.
  let liveAttribution = "";
  let liveAccent: { fill: string; ink: string; onDark: string } | null = null;
  if (LIVE_ACTIVITY && activeSession) {
    const [cats, goals] = await Promise.all([
      listCategories(),
      listActiveGoals(),
    ]);
    liveAttribution = resolveAttribution(activeSession, cats, goals).text;
    liveAccent = resolveAttributionColor(activeSession, cats, goals);
  }

  // Free: the profile is already read above. `undefined` (the column doesn't
  // exist yet) deliberately yields null — see patchNoteToShow.
  const patchNote = patchNoteToShow(profile?.patch_notes_seen_version);
  // Free too, off the same profile: whether to ask for UW info (lib/uw-prompt.ts).
  const uwPrompt = uwPromptFor(profile, UW);
  // The in-app survey (lib/survey.ts). Free for everyone who has finished it:
  // survey_done is on the same profile. Only a member who still owes it pays
  // one read, for where to resume. A failed read (null) shows nothing, since
  // the modal can't be skipped and its writes would be failing too.
  const surveyAnswered =
    SURVEY && surveyOwed(profile) ? await listMySurveyAnswers(SURVEY.id) : null;
  const showSurvey =
    SURVEY !== null &&
    surveyAnswered !== null &&
    firstUnanswered(surveyAnswered, SURVEY) !== null;

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
    // gets no app shell at all. Shell still mounts AnalyticsLifecycle: hitting
    // the wall is exactly the drop-off worth measuring.
    return (
      <Shell userId={user?.id ?? null} activeSessionId={null}>
        <BetaFull position={waitlistPosition} />
        <Toaster />
      </Shell>
    );
  }

  return (
    <Shell userId={user?.id ?? null} activeSessionId={activeSession?.id ?? null}>
      {children}
      {/* Hidden until onboarding is finished: the wizard owns the whole
          viewport and now renders at `/` rather than behind a redirect to
          /onboarding, so the pathname check inside BottomNav can no longer see
          it. A user mid-onboarding has nothing to navigate to anyway. */}
      {user && profile?.onboarded_at != null && (
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
            baked into THIS payload: a path check in the leaf can only fail open;
            this fails closed. completeOnboarding's revalidation does re-render
            the layout (any action revalidation does, in Next 16.2), but only
            after stamping a brand-new account current, so that payload already
            reads the note as seen.
          · !planComplete — that modal outranks this one (it's about the user's
            own data and carries a CTA), and two Base UI dialogs would stack two
            backdrops and fight over the focus trap. Yielding costs nothing:
            suppressing doesn't stamp, so the note waits for the next load.
          · patchNote — null when there's nothing to announce, or when the column
            doesn't exist yet.
          No next/dynamic, matching PlanCompleteModal: a client component imported
          by a SERVER component is already its own chunk, fetched only when the
          payload actually contains it — once per user per release. */}
      {/* The survey, until every question is answered (lib/survey.ts). It
          can't be skipped, so it outranks the release note and the UW prompt
          below, which wait, unstamped, for the load after it's done. It still
          yields to the plan-complete modal, for the same no-stacking reason.
          surveyOwed() already requires onboarded_at. */}
      {user && SURVEY && showSurvey && surveyAnswered && !planComplete && (
        <SurveyModal survey={SURVEY} answered={surveyAnswered} />
      )}
      {user && profile?.onboarded_at != null && !planComplete && !showSurvey && patchNote && (
        <WhatsNewModal
          version={patchNote.version}
          title={patchNote.title}
          intro={patchNote.intro}
          items={patchNote.items}
          outro={patchNote.outro}
          image={patchNote.image}
        />
      )}
      {/* The UW info prompt, once (lib/uw-prompt.ts). Last in line behind the
          plan-complete modal and the release note, for the same no-stacking
          reason: suppressing doesn't stamp, so it waits for the next load.
          uwPromptFor() already requires onboarded_at. */}
      {user && uwPrompt.sheet && !planComplete && !showSurvey && !patchNote && (
        <UwPromptOnLoad groupsLive={FRIENDS_V3} />
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
      {/* The iOS Live Activity, on the same flat-primitives rule and for a
          sharper reason: ActivityKit THROTTLES update bursts, so an object
          literal here would re-animate the Dynamic Island on every layout
          render. Note the failure mode differs from the clock leaf above —
          there a literal is catastrophic and invisible (each cancel-then-
          schedule wipes the previous run before it fires); here the
          fingerprint absorbs it, which is exactly why the rule has to be
          written down. Nothing would fail loudly enough to teach the next
          person.

          Three fields the clock leaf doesn't need: `label`, because the card
          names the task; `breakMs`, because the card RENDERS the break
          countdown where a paused session simply schedules nothing; and
          `onBreak`, because it decides whether the button says Pause or End
          break — pausedSince alone cannot tell them apart. */}
      {user && (
        <SyncLiveActivity
          sessionId={activeSession?.id ?? null}
          label={activeSession?.taskName ?? ""}
          attribution={liveAttribution}
          accent={liveAccent}
          startedAt={activeSession?.startedAt ?? null}
          pausedMs={activeSession?.pausedMs ?? null}
          pausedSince={activeSession?.pausedSince ?? null}
          plannedWorkMs={activeSession?.plannedWorkMs ?? null}
          breakMs={activeSession?.breakMs ?? null}
          onBreak={activeSession?.onBreak ?? false}
        />
      )}
      {/* The retired daily habit reminder's leftovers: cancels the week of
          them an older build queued on this device. Ungated, because the
          queue belongs to the phone, not the account. */}
      <ClearHabitReminders />
      {/* One listener for every notification family — routes a tap by its
          reserved id. Lives outside the sync leaves so it survives either
          flag being off. */}
      {user && <NotificationTapRouter />}
      {/* Custom-scheme deep links (world.progra.app://…). Ungated by any
          feature flag for the same reason as the tap router: Capacitor fires
          appUrlOpen and navigates nothing, so without this ANY deep link is a
          no-op — not just the Live Activity's. */}
      {user && <DeepLinkRouter />}
      {/* Gated on `user`: the push token is stored against the current
          user, so there's nothing to save until someone is signed in.
          No-op on web. */}
      {user && <PushRegistration />}
      {/* Remembers the previous route so a bug report filed from /settings can
          name the screen the bug actually happened on. Renders nothing. */}
      {user && <RouteMemory />}
      <Toaster />
    </Shell>
  );
}

// One definition of the html/body chrome, shared by the app tree and the
// beta-full wall so the two can never drift on fonts or layout.
function Shell({
  children,
  userId,
  activeSessionId,
}: {
  children: React.ReactNode;
  userId: string | null;
  activeSessionId: string | null;
}) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${newsreader.variable} h-full antialiased`}
      // The head script adds `dark` to this element's class before React
      // hydrates, which is a mismatch by design.
      suppressHydrationWarning={DARK_MODE}
    >
      {DARK_MODE && (
        <head>
          {/* Before first paint, so a dark device never flashes the light
              theme on a cold launch. A plain inline script rather than
              next/script: beforeInteractive is queued behind the framework
              bootstrap, which is after paint. */}
          <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        </head>
      )}
      <body className="min-h-full flex flex-col">
        {children}
        {/* Ungated on purpose: a leaf gated on `user` can never observe user
            becoming null, which is the event it exists to catch. Living in
            Shell means the beta-full wall gets it too. */}
        <NotificationLifecycle userId={userId} />
        {/* Ungated for the same reason, plus one more: the signed-out landing
            and the beta-full wall are exactly where drop-off matters most. */}
        <AnalyticsLifecycle userId={userId} activeSessionId={activeSessionId} />
        {/* Ungated by user: the login screen follows the theme too. */}
        {DARK_MODE && <SyncAppearance />}
      </body>
    </html>
  );
}
