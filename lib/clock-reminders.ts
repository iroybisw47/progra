import { formatDuration } from "@/lib/duration";
import {
  SESSION_CAP_MS,
  plannedEndMs,
  type SessionPlan,
  type SessionTiming,
} from "@/lib/session";

// WHICH on-device reminders an active session should have, and at what
// wall-clock instant each one fires.
//
// Pure on purpose: no Capacitor import, no `window`, no scheduling. The native
// bridge (pass 2) and the layout leaf that drives it (pass 3) consume this
// list; everything hard about the feature is decided here, where it's testable.
//
// THE ONE IDEA: the app measures WORKED time, notifications fire at wall-clock
// instants. Converting between them is the whole job, and it's arithmetic that
// already exists —
//
//     wall-clock instant of a mark at W worked-ms = startedAt + W + pausedMs
//
// which is exactly plannedEndMs(timing, W). Reusing it rather than rederiving
// it is what stops a notification and the on-screen countdown disagreeing.

export type ClockReminder = {
  // Stable, from the reserved range below.
  id: number;
  // Wall-clock epoch ms.
  at: number;
  title: string;
  body: string;
};

// Fixed IDs rather than hashes of a session UUID: there is at most ONE active
// session per user (a partial unique index enforces it), so a reserved range
// can't collide, and cancellation is simply "clear our whole range" — no need
// to remember which ids a previous session used.
export const DURATION_END_ID = 9001;
export const HOURLY_ID_BASE = 9101;

const HOUR_MS = 60 * 60 * 1000;

// Hourly nudges stop one hour short of the cap: autoClockOut ends a session at
// exactly SESSION_CAP_MS of worked time, so a nudge there would arrive as the
// session died. Derived from the cap so it self-adjusts if the cap moves.
export const MAX_HOURLY_REMINDERS = Math.max(
  0,
  Math.ceil(SESSION_CAP_MS / HOUR_MS) - 1
);

export function hourlyReminderId(hour: number): number {
  return HOURLY_ID_BASE + hour;
}

// Every reminder id this module can ever issue — what pass 3 cancels wholesale
// before scheduling a fresh set, and on clock-out.
export function allReminderIds(): number[] {
  const ids = [DURATION_END_ID];
  for (let h = 1; h <= MAX_HOURLY_REMINDERS; h++) ids.push(hourlyReminderId(h));
  return ids;
}

export function clockReminders(
  timing: SessionTiming,
  plan: SessionPlan,
  now: number,
  // How long an "hour" is. Only ever overridden by the `fast` test mode, which
  // shortens it to two minutes — passed IN rather than read from a flag here,
  // so this module stays pure and its tests stay independent of the env.
  hourMs: number = HOUR_MS
): ClockReminder[] {
  // An ended session has nothing pending.
  if (timing.endedAt !== null) return [];

  // PAUSED → nothing is schedulable, and this includes breaks (a break IS a
  // pause). Worked time is frozen, so every future instant depends on when the
  // user resumes, which is unknowable. Callers cancel on an empty list;
  // resuming revalidates and reschedules from the new pausedMs.
  //
  // This falls out of the worked-time model rather than being a special case,
  // and it's why "pausing doesn't touch notifications" was never viable.
  if (timing.pausedSince !== null) return [];

  // TIMED: exactly one alert, at the target. No hourly — a nudge partway
  // through a session you've already given an end to is noise, and it would
  // land mid-break.
  if (plan.plannedWorkMs !== null) {
    const at = plannedEndMs(timing, plan.plannedWorkMs);
    if (at <= now) return []; // already passed; the app ends it on next open
    return [
      {
        id: DURATION_END_ID,
        at,
        title: "Time's up",
        body: `Your ${formatDuration(plan.plannedWorkMs)} session is done.`,
      },
    ];
  }

  // OPEN-ENDED: hourly nudges, one per hour of WORKED time.
  const out: ClockReminder[] = [];
  for (let hour = 1; hour <= MAX_HOURLY_REMINDERS; hour++) {
    const workedMark = hour * hourMs;
    // Same conversion as the timed branch — deliberately the same function.
    const at = plannedEndMs(timing, workedMark);
    // Drop marks already behind us: opening three hours into a session must
    // not fire alerts for hours one and two.
    if (at <= now) continue;
    out.push({
      id: hourlyReminderId(hour),
      at,
      title: "Still clocked in",
      body:
        hour === 1
          ? "You're 1 hour in — keep going!"
          : `You're ${hour} hours in — keep going!`,
    });
  }
  return out;
}
