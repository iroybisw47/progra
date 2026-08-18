"use client";

import { useEffect } from "react";

import { clockReminders } from "@/lib/clock-reminders";
import { syncClockReminders } from "@/lib/clock-notifications";
import {
  CLOCK_REMINDERS,
  REMINDER_CAP_MS,
  REMINDER_HOUR_MS,
} from "@/lib/flags";
import { useNotificationPermission } from "@/lib/use-notification-permission";
import { useRemindersEnabled } from "@/lib/use-reminders-enabled";

// Keeps the device's scheduled clock reminders in step with the active session.
//
// ONE leaf in the root layout, not six wired-up call sites. Every mutation —
// pauseSession, resumeSession, startBreak, endBreak, clockOut,
// completePlannedSession, autoClockOut, clearSessionPlan — ends in
// revalidateSessionSurfaces(), which revalidates the layout, which re-renders
// this with fresh timing. So it reacts to every path that can change the
// schedule, INCLUDING ones nobody remembered to wire up. That's the property
// that makes this safe rather than merely tidy.
//
// syncClockReminders always cancels the whole reserved id range before
// scheduling, so "no active session" is just an empty list — no separate
// cancellation path to forget.
export function SyncClockReminders({
  sessionId,
  startedAt,
  pausedMs,
  pausedSince,
  plannedWorkMs,
}: {
  sessionId: string | null;
  startedAt: number | null;
  pausedMs: number | null;
  pausedSince: number | null;
  plannedWorkMs: number | null;
}) {
  // In the deps below, so granting permission mid-session schedules straight
  // away. Without it a user who enables notifications while clocked in gets
  // nothing until the next revalidate — the sync bails on a non-granted read,
  // and no session field has changed to retrigger it.
  const permission = useNotificationPermission();
  const enabled = useRemindersEnabled(sessionId);

  useEffect(() => {
    if (!CLOCK_REMINDERS) return;

    // The per-session toggle applies ONLY to open-ended sessions, matching the
    // band that sets it — a timed session's "Time's up" alert is the reason you
    // set a duration, and isn't optional.
    //
    // The guard is not just cosmetic symmetry. "Keep going" at the target calls
    // clearSessionPlan() on the SAME session id, so a session can go timed →
    // open-ended and back within one id; without this check an "off" flag set
    // while it was open-ended could ride back onto a timed session and suppress
    // the completion alert.
    const silenced = !enabled && plannedWorkMs === null;

    // No active session, or reminders off for this one → empty list → cancel
    // everything. syncClockReminders clears the whole reserved range before it
    // schedules, so "off" needs no unscheduling code of its own.
    const reminders =
      sessionId === null || startedAt === null || silenced
        ? []
        : clockReminders(
            {
              startedAt,
              endedAt: null,
              pausedMs: pausedMs ?? 0,
              pausedSince,
            },
            {
              // Only plannedWorkMs is read — it decides hourly vs one-shot.
              // Breaks need no field here: a break sets pausedSince, and a
              // paused session yields an empty list.
              plannedWorkMs,
              workIntervalMs: null,
              breakMs: null,
              onBreak: false,
              breaksTaken: 0,
            },
            Date.now(),
            REMINDER_HOUR_MS,
            REMINDER_CAP_MS
          );

    void syncClockReminders(reminders);
  }, [
    sessionId,
    startedAt,
    pausedMs,
    pausedSince,
    plannedWorkMs,
    permission,
    enabled,
  ]);

  return null;
}
