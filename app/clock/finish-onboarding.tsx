"use client";

import { useEffect, useRef } from "react";

import { completeOnboarding } from "@/app/actions/profile";
import { track } from "@/lib/analytics";
import { onboardingStamper } from "@/lib/clock-handoff";

// The mounted leaf's stamp, while there is one. Module scope because the leaf
// and ClockClient are siblings in app/clock/page.tsx, and cleared on unmount,
// so it never outlives the visit (or the account) it belongs to.
let mounted: (() => Promise<boolean>) | null = null;

// The end of a first run through onboarding v3. Screen 6's "Start session"
// opens the normal Clock tab (lib/clock-handoff.ts), and app/clock/page.tsx
// mounts this beside it while onboarded_at is still unset. It stamps
// onboarded_at and renders nothing.
//
// Here and not on Screen 6: completeOnboarding revalidates, which re-renders
// the route it's called from. Called at `/`, that would swap the wizard for
// Progress in the middle of its exit. Called here, `/` has already been left.
// The same write-from-a-mount precedent as EnsureProfileSync in
// app/layout.tsx. The stamp is also what mounts the BottomNav, since the
// layout shows it only once onboarded_at is set, so the nav rises in a beat
// after the Clock tab does (lib/nav-rise.ts).
//
// One stamp per mount (onboardingStamper), which the ref holds through
// React's dev double-run of effects. A failed try is retried at once,
// quietly, and if that fails too, the Clock-in tap tries again before it
// clocks in (settleOnboardingStamp), since clocking in leaves this page and
// nothing else would. The stamp's own re-render then reads onboarded_at and
// drops this leaf, so Back to this page or a reload neither stamps again nor
// counts a second completion. The count is v2's event, sent once, when a
// stamp lands. A replayer has nothing to stamp, so this never mounts for one,
// and the wizard counts their completion on the tap instead.
export function FinishOnboarding() {
  const stamp = useRef<(() => Promise<boolean>) | null>(null);
  useEffect(() => {
    stamp.current ??= onboardingStamper(completeOnboarding, () =>
      track("onboarding_completed")
    );
    const mine = stamp.current;
    mounted = mine;
    // On React's dev re-run of this effect, joins the stamp already in flight
    // rather than starting another.
    void mine();
    return () => {
      if (mounted === mine) mounted = null;
    };
  }, []);

  return null;
}

// For ClockClient's Clock-in tap, before it clocks in: joins a stamp still in
// flight, or tries once more after one that failed. Resolves at once when no
// leaf is mounted, which is the Clock tab for everyone else, or once the
// stamp has landed. Clock in goes ahead whatever this answers.
export function settleOnboardingStamp(): Promise<boolean> {
  return mounted ? mounted() : Promise.resolve(true);
}
