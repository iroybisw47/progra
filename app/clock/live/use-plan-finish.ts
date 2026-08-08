"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  clearSessionPlan,
  completePlannedSession,
} from "@/app/actions/sessions";
import {
  isPlanComplete,
  plannedEndMs,
  type SessionPlan,
  type SessionTiming,
} from "@/lib/session";
import { playTimerCue } from "@/lib/timer-sound";

// Seconds of grace before a timed session ends itself, while you're watching.
const GRACE_SECONDS = 5;

// Owns "the target was reached and you're looking at the timer".
//
// Everywhere ELSE that's <EnsurePlanComplete/>'s job, and it ends the session
// immediately — nobody is watching, so there's nothing to interrupt. That leaf
// skips /clock/live precisely so this can run instead.
//
// "Keep going" clears the plan rather than skipping the auto-end once. A timed
// session left running past its target is an incoherent state: the moment you
// navigate away, the root leaf ends it anyway, so a skip would undo nothing.
// Dropping the plan turns it into an ordinary open-ended session, which is the
// only outcome that stays true after you leave this screen.
export function usePlanFinish({
  timing,
  plan,
  enabled,
  onFinished,
}: {
  timing: SessionTiming;
  plan: SessionPlan;
  enabled: boolean;
  onFinished: (sessionId: string) => void;
}) {
  const router = useRouter();
  const { startedAt, pausedMs, pausedSince } = timing;
  const { plannedWorkMs } = plan;

  // null = not finishing. Otherwise seconds remaining in the grace window.
  //
  // The "already past the target when this mounted" case is seeded in a LAZY
  // INITIALIZER, not an effect. Setting it synchronously inside one trips
  // react-hooks/set-state-in-effect, and this repo's lint baseline of 10 is a
  // gate — an initializer is also simply the right tool: it's the value at
  // first render, not a reaction to one. (Date.now() here is fine for the same
  // reason the live timer seeds `seedNow` this way.)
  const [finishingIn, setFinishingIn] = useState<number | null>(() =>
    enabled &&
    plannedWorkMs !== null &&
    pausedSince === null &&
    isPlanComplete(
      { startedAt, endedAt: null, pausedMs, pausedSince },
      { plannedWorkMs },
      Date.now()
    )
      ? GRACE_SECONDS
      : null
  );

  const keepGoing = useCallback(() => {
    setFinishingIn(null);
    void clearSessionPlan().then((r) => {
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast("Target dropped — keep going as long as you like");
      router.refresh();
    });
  }, [router]);

  // Phase 1: schedule the moment the target lands, and open the grace window.
  useEffect(() => {
    if (!enabled || plannedWorkMs === null) return;
    // Paused or on a break → worked time is frozen, so the target can't arrive.
    if (pausedSince !== null) return;

    const t: SessionTiming = { startedAt, endedAt: null, pausedMs, pausedSince };
    // Already past it — the initializer above opened the window, so there's
    // nothing left to schedule.
    if (isPlanComplete(t, { plannedWorkMs }, Date.now())) return;

    const end = plannedEndMs(t, plannedWorkMs);
    const id = window.setTimeout(() => {
      playTimerCue("finished");
      setFinishingIn(GRACE_SECONDS);
    }, Math.max(0, end - Date.now()));
    // A suspended webview never fires its timer; catch up on return.
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        isPlanComplete(t, { plannedWorkMs }, Date.now())
      ) {
        playTimerCue("finished");
        setFinishingIn(GRACE_SECONDS);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, startedAt, pausedMs, pausedSince, plannedWorkMs]);

  // Phase 2: tick the grace window down, then finish. Separate from phase 1 so
  // the countdown owns only itself — and so "Keep going" simply stops it.
  useEffect(() => {
    if (finishingIn === null) return;

    if (finishingIn <= 0) {
      void completePlannedSession().then((r) => {
        if ("error" in r) {
          toast.error(r.error);
          setFinishingIn(null);
          return;
        }
        // Not ended means another tab won the race, or the plan was cleared
        // underneath us — pull fresh state rather than route to a stale id.
        if (!r.ended) {
          setFinishingIn(null);
          router.refresh();
          return;
        }
        onFinished(r.sessionId);
      });
      return;
    }

    const id = window.setTimeout(() => setFinishingIn((n) => (n ?? 1) - 1), 1000);
    return () => window.clearTimeout(id);
  }, [finishingIn, onFinished, router]);

  return { finishingIn, keepGoing };
}
