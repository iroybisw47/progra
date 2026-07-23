import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarIcon, TimerIcon, UsersIcon } from "lucide-react";

import { AddToHomeHint } from "@/components/add-to-home-hint";
import { GoogleSignInButton } from "@/app/login/google-sign-in-button";
import { Dashboard } from "@/components/dashboard";
import { Feed } from "@/components/feed";
import { ProgressClient } from "@/components/v2/progress-client";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { REDESIGN, SOCIAL_ENABLED } from "@/lib/flags";
import {
  currentWeekStart,
  loadProgressData,
  loadWeekHabits,
} from "@/lib/db/progress";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return <SignedOutLanding />;

  // In the redesign, Home is the Progress tab (Today / This week / History) —
  // the consolidated dashboard + recap + history glance. The onboarding gate
  // still fires first.
  if (REDESIGN) {
    const profile = await getProfile();
    if (!profile?.onboarded_at) redirect("/onboarding");
    // The week start is derivable from the profile alone, so both loaders run
    // in parallel instead of habits waiting on the full progress read.
    const weekStart = currentWeekStart(profile.timezone ?? "UTC");
    const [data, { habits, completions, minWeekStart }] = await Promise.all([
      loadProgressData(),
      loadWeekHabits(weekStart),
    ]);
    return (
      <ProgressClient
        {...data}
        habits={habits}
        completions={completions}
        minWeekStart={minWeekStart}
      />
    );
  }

  // With social on, Home becomes the feed and the personal dashboard moves to
  // the `/me` tab. The onboarding gate still fires here (the dashboard does its
  // own gate on the flag-off path). Beta (flag off) keeps Home = dashboard.
  if (SOCIAL_ENABLED) {
    const profile = await getProfile();
    if (!profile?.onboarded_at) redirect("/onboarding");
    return <Feed />;
  }

  return <Dashboard email={user.email ?? ""} />;
}

function SignedOutLanding() {
  return (
    <div className="flex flex-1 flex-col items-center px-5">
      {/* my-auto keeps the hero vertically centered while the footer sits at
          the viewport bottom without introducing scroll. */}
      <main className="my-auto flex w-full max-w-sm flex-col items-center gap-6 pt-16 text-center">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">
            The first community-based productivity app.
          </p>
        </header>
        {/* Starts the OAuth flow directly — no intermediate /login stop. */}
        <GoogleSignInButton label="Sign in with Google" />

        {/* Feature blurb — also makes the optional Google Calendar connection
            visible to signed-out visitors (and OAuth reviewers). */}
        <ul className="text-muted-foreground flex w-full flex-col gap-3 text-left text-sm">
          <li className="flex items-start gap-2.5">
            <TimerIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
            <span>Set goals and clock in to log your study sessions.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CalendarIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
            <span>
              Optionally connect Google Calendar (read-only) to log your
              calendar events alongside your tracked time.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <UsersIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
            <span>Share sessions and track progress with friends.</span>
          </li>
        </ul>

        <AddToHomeHint />
      </main>

      <footer className="text-muted-foreground pt-6 pb-[max(env(safe-area-inset-bottom),24px)] text-xs">
        © 2026 Progra ·{" "}
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
