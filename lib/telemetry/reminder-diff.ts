// The pure half of local-notification logging. A device cannot report that a
// notification was DELIVERED — only that it scheduled one, or cancelled one
// before it fired. So the engine (lib/notification-sync.ts) asks iOS what is
// still pending, compares it with the schedule it is about to write, and
// reports exactly the differences; "presumed fired" (scheduled, never
// cancelled, instant in the past) is derived server-side.
//
// The key is `local:<id>:<epoch ms>` and travels INSIDE the notification as
// `extra.key`, so what comes back from getPending() is byte-identical to what
// was scheduled — the schedule date iOS hands back is rounded to the second
// and would not be.

import { isHabitReminderId } from "@/lib/habit-reminders";
import type { NotificationType } from "@/lib/telemetry/events";

export type LocalKeyed = { id: number; at: number };

export function localNotificationKey(id: number, at: number): string {
  return `local:${id}:${Math.round(at)}`;
}

// The two local families, by their reserved id ranges.
export function reminderTypeForId(id: number): NotificationType {
  return isHabitReminderId(id) ? "habit_reminder" : "clock_in_reminder";
}

export function diffReminderSchedule(
  previousKeys: readonly string[],
  next: readonly LocalKeyed[]
): { scheduled: LocalKeyed[]; cancelled: string[] } {
  const prev = new Set(previousKeys);
  const nextKeys = new Set(next.map((n) => localNotificationKey(n.id, n.at)));
  return {
    scheduled: next.filter((n) => !prev.has(localNotificationKey(n.id, n.at))),
    cancelled: [...prev].filter((k) => !nextKeys.has(k)),
  };
}
