import { allReminderIds, type ClockReminder } from "@/lib/clock-reminders";
import { createReminderSync } from "@/lib/notification-sync";

// The clock family's scheduled notifications: hourly nudges, the timed-session
// alert, the cap announcement. All of the mechanics — cancel-then-schedule,
// the load-bearing fingerprint, the permission gate — live in the shared
// engine (lib/notification-sync.ts); pass 1 decided which reminders exist and
// when (lib/clock-reminders.ts, pure and tested); this file just binds the two
// to the clock's reserved id range.

const engine = createReminderSync(allReminderIds);

// Replace the scheduled set with exactly `reminders`. There's at most one
// active session per user, so nothing else can own these ids, and an empty
// list degenerates to "cancel everything" — which is why the caller can be a
// single layout leaf instead of six wired-up call sites: every path that
// changes a session ends in revalidateSessionSurfaces, which re-renders the
// leaf, which calls this.
export const syncClockReminders: (
  reminders: ClockReminder[]
) => Promise<void> = engine.sync;

// Clear everything the clock family owns.
export const cancelClockReminders = engine.cancelAll;
