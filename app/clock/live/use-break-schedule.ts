"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { endBreak, startBreak } from "@/app/actions/sessions";
import {
  breakRemainingMs,
  isBreakDue,
  nextBreakDueAtWorkedMs,
  type SessionPlan,
  type SessionTiming,
} from "@/lib/session";

// Drives the automatic half of a timed session's break schedule: starting a
// break when an interval's worth of work is done, and ending it when it elapses.
//
// Modelled on <EnsureSessionCap/> rather than a ticking hook. There is no cron
// in this app, so this is lazy by design:
//
//   * ONE exact setTimeout for the next transition — no 1s interval, no
//     re-render of the 600-line timer on every tick.
//   * A visibilitychange re-check, because a backgrounded webview throttles or
//     suspends timers and the moment can pass unobserved.
//   * A module-level in-flight guard so two tabs (or a timer racing a
//     visibility check) can't fire the same transition twice. The server
//     actions are guarded too — this just avoids the wasted round-trip.
//
// Deliberately does nothing while the app is closed. Per the design: a break
// you were never offered didn't happen, so it isn't recorded. That's what
// keeps every recorded break one the user actually took, with no replay logic.
let inFlight = false;

export function useBreakSchedule({
  sessionId,
  timing,
  plan,
  enabled,
}: {
  sessionId: string;
  timing: SessionTiming;
  plan: SessionPlan;
  enabled: boolean;
}) {
  const router = useRouter();
  const { startedAt, pausedMs, pausedSince } = timing;
  const { plannedWorkMs, workIntervalMs, breakMs, onBreak, breaksTaken } = plan;

  useEffect(() => {
    if (!enabled || plannedWorkMs === null || workIntervalMs === null) return;
    // Manually paused (not on a break): worked time is frozen, so no boundary
    // can be crossed. Resuming revalidates and remounts this with fresh timing.
    if (pausedSince !== null && !onBreak) return;

    const t: SessionTiming = { startedAt, endedAt: null, pausedMs, pausedSince };
    const p: SessionPlan = {
      plannedWorkMs,
      workIntervalMs,
      breakMs,
      onBreak,
      breaksTaken,
    };

    let cancelled = false;

    async function fire() {
      if (cancelled || inFlight) return;
      const now = Date.now();
      const due = onBreak
        ? breakRemainingMs(t, p, now) <= 0
        : isBreakDue(t, p, now);
      if (!due) return;

      inFlight = true;
      try {
        const r = onBreak ? await endBreak() : await startBreak();
        if (!cancelled && !("error" in r)) router.refresh();
      } finally {
        inFlight = false;
      }
    }

    // How long until the transition is due, from worked time — never wall
    // clock, since pauses and breaks push the boundary out.
    function msUntilTransition(): number {
      const now = Date.now();
      if (onBreak) return breakRemainingMs(t, p, now);
      const due = nextBreakDueAtWorkedMs(p);
      if (due === null) return Number.POSITIVE_INFINITY;
      const worked = Math.max(0, now - startedAt - pausedMs);
      return due - worked;
    }

    // Already past it (the app was closed through the boundary) — fire now.
    const delay = msUntilTransition();
    if (delay <= 0) {
      void fire();
      return () => {
        cancelled = true;
      };
    }

    // setTimeout caps at ~24.8 days; a session can't run that long under the
    // 10-hour cap, so no chunking is needed.
    const id = window.setTimeout(() => void fire(), delay);
    // A suspended tab never fires its timer, so re-check on the way back.
    const onVisible = () => {
      if (document.visibilityState === "visible") void fire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    enabled,
    sessionId,
    startedAt,
    pausedMs,
    pausedSince,
    plannedWorkMs,
    workIntervalMs,
    breakMs,
    onBreak,
    breaksTaken,
    router,
  ]);
}
