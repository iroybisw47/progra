// The retired daily habit reminder's reserved notification ids.
//
// The reminder itself is gone (2026-10-21): the streak reminder's 7pm push
// covers the same "you haven't shown up today" moment. What stays is its id
// range, because the reminders it scheduled outlive the code that scheduled
// them — each sync queued a week of one-shot local notifications on the
// device, and only something that knows these ids can cancel them
// (components/clear-habit-reminders.tsx), route a tap on one that already
// arrived, or label it in telemetry.

// Fixed ids, one per day-offset, in a range reserved beside the clock's
// (9001/9002 and 9101–9110). 9201 was today, 9207 six days out.
export const HABIT_REMINDER_ID_BASE = 9201;
export const HABIT_REMINDER_DAYS = 7;

export function habitReminderId(dayOffset: number): number {
  return HABIT_REMINDER_ID_BASE + dayOffset;
}

// Tap routing: is this notification one of ours? The single action listener
// (components/notification-tap-router.tsx) discriminates families by id —
// habit taps land on the dashboard checklist, clock taps on /clock/live.
export function isHabitReminderId(id: number | undefined): boolean {
  return (
    id !== undefined &&
    id >= HABIT_REMINDER_ID_BASE &&
    id < HABIT_REMINDER_ID_BASE + HABIT_REMINDER_DAYS
  );
}

// Every id this range can ever hold — what the cleanup cancels wholesale.
export function allHabitReminderIds(): number[] {
  const ids: number[] = [];
  for (let d = 0; d < HABIT_REMINDER_DAYS; d++) ids.push(habitReminderId(d));
  return ids;
}
