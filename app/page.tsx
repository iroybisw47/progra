import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { AddToHomeHint } from "@/components/add-to-home-hint";
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
    <div className="flex flex-1 items-center justify-center px-5 pb-24">
      <main className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">
            Plan your week. Track deep work. See where your time goes.
          </p>
        </header>
        <Link
          href="/login"
          className={buttonVariants({ className: "h-11 w-full text-base" })}
        >
          Sign in with Google
        </Link>

        <AddToHomeHint />
      </main>
    </div>
  );
}
