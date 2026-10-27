import { allHabitReminderIds } from "@/lib/habit-reminders";
import { createReminderSync } from "@/lib/notification-sync";

// The retired habit family's scheduled notifications. Nothing schedules into
// this range any more; the engine (lib/notification-sync.ts) is bound to it
// only so the reminders an older build queued can be cleared, and their
// cancellation logged like any other.
const engine = createReminderSync(allHabitReminderIds);

// Clear everything the habit family owns. Run once per app launch
// (components/clear-habit-reminders.tsx) and when a session ends (sign-out,
// account deletion, switching users).
export const cancelHabitReminders = engine.cancelAll;
