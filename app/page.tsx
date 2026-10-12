import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { TrackView } from "@/components/track-view";
import { AddToHomeHint } from "@/components/add-to-home-hint";
import { SignInButtons } from "@/app/login/sign-in-buttons";
import { Dashboard } from "@/components/dashboard";
import { Feed } from "@/components/feed";
import { ProgressClient } from "@/components/v2/progress-client";
import { RecapGround } from "@/components/recap-story/recap-ground";
import { RecapStoryV2 } from "@/components/recap-story/recap-story-v2";
import { OnboardingClientV2 } from "@/app/onboarding/onboarding-client-v2";
import { OnboardingClientV3 } from "@/app/onboarding/onboarding-client-v3";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { ONBOARDING_V3, RECAP_V2, REDESIGN, SOCIAL_ENABLED, UW } from "@/lib/flags";
import { isJohnUser } from "@/lib/john/cohort";
import { getFriendRelations } from "@/lib/db/friends";
import { listActiveGoals } from "@/lib/db/goals";
import { listActiveHabits, listUnansweredHabits } from "@/lib/db/habits";
import { getDueReview, loadRecapStory } from "@/lib/db/recap-story";
import { accountGoalsFrom, accountHabitsFrom } from "@/lib/onboarding-v3-goals-habits";
import { savedUwFrom } from "@/lib/onboarding-v3-uw";
import { addDaysISO, todayInTimeZone } from "@/lib/dates";
import {
  currentWeekStart,
  loadProgressData,
  loadWeekHabits,
} from "@/lib/db/progress";

// "Today · {date}" is derived from the live clock at render time — force
// per-request rendering so the route is never served from a frozen cache entry.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; review?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <SignedOutLanding />;

  // In the redesign, Home is the Progress tab (Today / Week) — the
  // consolidated dashboard + recap glance. The onboarding gate still fires
  // first.
  if (REDESIGN) {
    const profile = await getProfile();
    // The onboarding gate RENDERS the wizard rather than redirecting to it.
    //
    // `redirect("/onboarding")` here was the cause of the React #310 flash
    // ("Rendered more hooks than during the previous render") that every new
    // user saw for about a second on their first sign-in — a known Next.js bug
    // (vercel/next.js#78396, dup of #63121) that fires when a Server Component
    // redirect, a Suspense boundary (any loading.tsx) and a server read during
    // render all meet. Loading /onboarding directly was always clean; only the
    // redirect path threw. Removing any one of the three fixes it, and the
    // redirect is the one we don't need.
    //
    // It also deletes real work: the redirect made the browser fetch a second
    // document and ran the root layout's ~13 queries TWICE, throwing the first
    // set away — cache() is per-request and cannot span a 307.
    //
    // /onboarding stays a real route: Settings → Replay pushes to it, which is
    // a soft navigation with no redirect and no flash.
    //
    // ONBOARDING_V3 swaps in the six-screen wizard. Off, this is v2 exactly
    // as before. `replay` is false by definition here: this branch only runs
    // while onboarded_at is null.
    //
    // v3 reads the active goals and habits too. A fresh account has none, but
    // one that reloads after Screen 2 saved has, and the wizard has to start
    // from them or Continue would create them all a second time. Likewise its
    // friendships, so Screen 5 knows the requests it already sent (a reload,
    // or an /i/ link's request to the inviter) and anyone already a friend.
    // And with UW on, the profile's UW answer: one reloaded after the UW
    // sheet saved Yes finds it open on the bar rather than asking again (P9c).
    if (!profile?.onboarded_at) {
      if (ONBOARDING_V3) {
        const [goals, habits, relations] = await Promise.all([
          listActiveGoals(),
          listActiveHabits(),
          getFriendRelations(),
        ]);
        return (
          <OnboardingClientV3
            initialUsername={profile?.username ?? ""}
            initialDisplayName={profile?.display_name ?? null}
            avatarUrl={avatarPublicUrl(profile?.avatar_path ?? null)}
            replay={false}
            existingGoals={accountGoalsFrom(goals)}
            existingHabits={accountHabitsFrom(habits)}
            relations={relations}
            uw={UW}
            savedUw={UW ? savedUwFrom(profile) : undefined}
          />
        );
      }
      return (
        <OnboardingClientV2
          initialUsername={profile?.username ?? ""}
          initialDisplayName={profile?.display_name ?? null}
          avatarUrl={avatarPublicUrl(profile?.avatar_path ?? null)}
        />
      );
    }
    // `?tab=week` opens the Week sub-tab directly. History is no longer a
    // sub-tab (the Sessions header links straight to /history), so an old
    // `?tab=history` link just lands on Today.
    const { tab, review } = await searchParams;
    const initialTab = tab === "week" ? "week" : undefined;
    // The weekly review (RECAP_V2): from Monday 6am local, the week that just
    // ended opens BY ITSELF the next time Progress renders, until it's been
    // closed once. It's drawn here, in place of Progress, rather than
    // redirected to — the same reason the onboarding gate above renders instead
    // of redirecting. `?review=later` is the escape hatch the story takes if
    // recording the week fails.
    // The week start is derivable from the profile alone, so both loaders run
    // in parallel instead of habits waiting on the full progress read.
    const weekStart = currentWeekStart(profile.timezone ?? "UTC");
    // John: yesterday in the user's own timezone, and the habits from it that
    // were neither ticked nor already explained. listUnansweredHabits returns []
    // with the flag off, so this costs the other ~50 users nothing.
    const missDate = addDaysISO(todayInTimeZone(profile.timezone ?? "UTC"), -1);
    //
    // Progress's reads start FIRST and the due check (one small query) runs
    // beside them, so the usual load waits for nothing extra; when a review is
    // due it doesn't wait for Progress either. Those reads are then spent,
    // once a week, on this one render. The catch is attached up front so a
    // rejection while the check is in flight is never unhandled — the await
    // below still sees it.
    const progress = Promise.all([
      loadProgressData(),
      loadWeekHabits(weekStart),
      listUnansweredHabits(missDate),
    ]);
    progress.catch(() => {});
    const dueReview = RECAP_V2 && review !== "later" ? await getDueReview() : null;
    if (dueReview) {
      // Navy straight away while the review's own reads run.
      return (
        <Suspense fallback={<RecapGround />}>
          <DueReview weekStartISO={dueReview.weekStartISO} />
        </Suspense>
      );
    }
    const [data, { habits, completions, minWeekStart }, missHabits] = await progress;
    return (
      <ProgressClient
        {...data}
        habits={habits}
        completions={completions}
        minWeekStart={minWeekStart}
        initialTab={initialTab}
        john={isJohnUser(profile)}
        missHabits={missHabits}
        missDate={missDate}
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

// The review that's due, in place of Progress. Closing it records the week, and
// that action's re-render of "/" is Progress again (components/recap-story).
async function DueReview({ weekStartISO }: { weekStartISO: string }) {
  const view = await loadRecapStory(weekStartISO);
  return <RecapStoryV2 view={view} entry="auto" markOnExit />;
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
            The world&rsquo;s first community-based productivity app.
          </p>
        </header>
        {/* Starts the OAuth flow directly — no intermediate /login stop. */}
        <SignInButtons googleLabel="Sign in with Google" />
        {/* By device id only — there is no user yet; linked at sign-in. */}
        <TrackView event="landing_viewed" />

        <AddToHomeHint />
      </main>

      <footer className="text-muted-foreground pt-6 pb-[max(env(safe-area-inset-bottom),24px)] text-xs">
        © 2026 Progra ·{" "}
        <Link href="/support" className="hover:underline">
          Support
        </Link>{" "}
        ·{" "}
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
