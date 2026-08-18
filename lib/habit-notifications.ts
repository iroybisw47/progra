import { allHabitReminderIds } from "@/lib/habit-reminders";
import { createReminderSync } from "@/lib/notification-sync";

// The habit family's scheduled notifications: the daily unchecked-habits
// nudge, one per day up to a week out. Mechanics in the shared engine
// (lib/notification-sync.ts), decisions in lib/habit-reminders.ts (pure and
// tested); this file binds the two to the habit family's reserved id range.
const engine = createReminderSync(allHabitReminderIds);

export const syncHabitReminders = engine.sync;
