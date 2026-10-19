// Onboarding v3's handoff to the Clock tab: the two ends' shared contract
// (.claude/plans/onboarding-v3.md, "OWNER-FIX-1"). Screen 6's "Start session"
// opens the NORMAL Clock tab with the first goal preselected, through the
// ?goal= preselect the tab already has, and ?welcome=1 is what tells
// app/clock/page.tsx to mount app/clock/finish-onboarding.tsx beside it to
// stamp onboarded_at, and (with CLOCK_REMINDERS off) to have the Clock-in tap
// ask for notifications. The owner chose this on 2026-10-09 over P7's
// generated first-session Clock: "onboarding should just load to the normal
// clock screen, but with the goal auto selected".
//
// Pure, so lib/clock-handoff.test.ts pins it.

import type { ActionResult } from "@/lib/onboarding-v3-services";

// Where "Start session" goes. `goalId` is the first goal's row
// (lib/onboarding-v3-goals-habits.ts, readyGoal). Without one, which Screen 2
// makes unreachable (it needs a goal to continue), onboarding still finishes,
// on the Clock tab as it opens for anyone.
export function clockHandoffHref(goalId: string | null | undefined): string {
  const id = goalId?.trim();
  return id ? `/clock?goal=${encodeURIComponent(id)}&welcome=1` : "/clock?welcome=1";
}

// Whether this render of /clock should mount the stamp: the handoff asked
// for it (?welcome=1), ONBOARDING_V3 is on (`enabled`), and there is
// something to stamp (`onboarded` is false).
//
// - Flag off: nothing links here, and a hand-typed ?welcome=1 is just the
//   Clock tab, as it was before v3.
// - Already onboarded: completeOnboarding is write-once, so a replayer has
//   nothing to stamp and the call would only revalidate. The wizard counts a
//   replay's completion itself, on the tap. It also covers the first run's
//   own visit once its stamp has landed: the stamp re-renders this page
//   without the leaf, so Back to it or a reload doesn't count the completion
//   twice.
//
// A repeated param counts by its first value, as Next hands it over as an
// array.
export function finishesOnboarding({
  enabled,
  welcome,
  onboarded,
}: {
  enabled: boolean;
  welcome: string | string[] | undefined;
  onboarded: boolean;
}): boolean {
  if (!enabled || onboarded) return false;
  return isWelcome(welcome);
}

function isWelcome(welcome: string | string[] | undefined): boolean {
  const value = Array.isArray(welcome) ? welcome[0] : welcome;
  return value === "1";
}

// How many times the stamp is tried: once, and once more if that fails.
export const STAMP_ATTEMPTS = 2;

// Stamps onboarded_at through `complete` (completeOnboarding), trying again
// at once if the first try fails, whether it answered an error or threw.
// Quietly either way, since the Clock tab has nothing to say about it. True
// once a try landed. If both fail, the Clock-in tap tries again before it
// clocks in (onboardingStamper below, finish-onboarding.tsx). Only if that
// fails too does the account stay un-onboarded: no BottomNav, and the next
// load of `/` offers the wizard again.
export async function stampOnboarding(
  complete: () => Promise<ActionResult>,
  attempts: number = STAMP_ATTEMPTS
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await complete();
      if (!("error" in r)) return true;
    } catch {
      // A failed round trip, which counts the same as an error answer.
    }
  }
  return false;
}

// One visit's stamp, shared by the leaf's mount and the Clock-in tap
// (finish-onboarding.tsx), so the two never count a completion twice.
// Calling it while a stamp is in flight joins that one; after one landed it
// answers true without writing again; after one failed, it tries again.
// `onLanded` runs once, for the try that landed.
export function onboardingStamper(
  complete: () => Promise<ActionResult>,
  onLanded: () => void
): () => Promise<boolean> {
  let landed = false;
  let pending: Promise<boolean> | null = null;
  return () => {
    if (landed) return Promise.resolve(true);
    pending ??= stampOnboarding(complete).then((ok) => {
      pending = null;
      if (ok) {
        landed = true;
        onLanded();
      }
      return ok;
    });
    return pending;
  };
}
