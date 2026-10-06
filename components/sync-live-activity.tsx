"use client";

import { useEffect } from "react";

import { LIVE_ACTIVITY, REMINDER_CAP_MS } from "@/lib/flags";
import { liveActivitySnapshot } from "@/lib/live-activity";
import { syncLiveActivity } from "@/lib/live-activity-sync";

// Keeps the iOS Live Activity in step with the active session.
//
// ONE leaf in the root layout, not a dozen wired-up call sites — the same
// argument SyncClockReminders makes, and for the same reason it works: every
// session mutation (clockIn, pauseSession, resumeSession, startBreak, endBreak,
// clearSessionPlan, completePlannedSession, autoClockOut, updateSession,
// deleteSession) ends in revalidateSessionSurfaces(), which revalidates the
// layout, which re-renders this with fresh timing. So it reacts to every path
// that can change the card, INCLUDING ones nobody remembered to wire up. A
// mid-session title edit reaches the Lock Screen for free that way.
//
// TWO paths it CANNOT observe, because they call
// revalidateSessionSurfacesExceptLive() and that deliberately skips the layout:
// clockOut, and editActiveSessionTime when it ends the session. Both call
// endLiveActivity() explicitly from live-timer-client.tsx. That is the one
// exception to the pattern and it is load-bearing — for reminders the cost of
// missing those is a stale nav ticker, but here it would be a Lock Screen card
// claiming a running session, with live buttons, after clock-out.
//
// A null snapshot ends the card, so "no active session" needs no teardown code
// of its own.
export function SyncLiveActivity({
  sessionId,
  label,
  startedAt,
  pausedMs,
  pausedSince,
  plannedWorkMs,
  breakMs,
  onBreak,
}: {
  sessionId: string | null;
  label: string;
  startedAt: number | null;
  pausedMs: number | null;
  pausedSince: number | null;
  plannedWorkMs: number | null;
  breakMs: number | null;
  onBreak: boolean;
}) {
  // Deliberately NOT in the deps, and worth saying why both are absent:
  //
  //   * notification permission — a Live Activity needs none, so there is
  //     nothing to re-run on a grant (see lib/live-activity-sync.ts).
  //   * the per-session reminder toggle — that silences NUDGES. Someone who
  //     turns reminders off still wants the card they can pause from; removing
  //     it would be a different feature than the one they switched off.
  useEffect(() => {
    if (!LIVE_ACTIVITY) return;

    void syncLiveActivity(
      sessionId === null || startedAt === null
        ? null
        : liveActivitySnapshot(
            sessionId,
            label,
            {
              startedAt,
              endedAt: null,
              pausedMs: pausedMs ?? 0,
              pausedSince,
            },
            // breaksTaken and workIntervalMs are deliberately not threaded
            // through: a "next break in 12m" line would be a promise the card
            // cannot keep, since useBreakSchedule only runs with the app open
            // and "a break you were never offered didn't happen".
            { plannedWorkMs, breakMs, onBreak },
            REMINDER_CAP_MS
          )
    );
  }, [
    sessionId,
    label,
    startedAt,
    pausedMs,
    pausedSince,
    plannedWorkMs,
    breakMs,
    onBreak,
  ]);

  return null;
}
