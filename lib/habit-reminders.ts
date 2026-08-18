// WHICH daily habit reminders the device should have scheduled, and at what
// wall-clock instant each one fires.
//
// Pure on purpose, exactly like lib/clock-reminders.ts: no Capacitor import,
// no `window`, no scheduling. The sync leaf (components/sync-habit-reminders.tsx)
// consumes this list; everything hard about the feature is decided here, where
// it's testable.
//
// THE ONE IDEA: a local notification must be scheduled BEFORE the moment it
// describes, but "did they check their habits?" is only knowable while the app
// is running. So every sync schedules a week of reminders and lets the next
// sync correct them:
//
//   - TODAY fires only if something is unchecked right now (and the time is
//     still ahead). Checking the last habit re-syncs and cancels it.
//   - Days 1–6 are scheduled unconditionally — a new day starts all-unchecked,
//     so "you haven't checked these off" is true at scheduling time. If the
//     user opens the app that day, the sync replaces the guess with the truth;
//     if they don't, the nudge is exactly what should fire.
//
// The week-long window is the retention property: someone who stops opening
// the app keeps being reminded for seven days, not one.

export type HabitReminder = {
  // Stable, from the reserved range below.
  id: number;
  // Wall-clock epoch ms.
  at: number;
  title: string;
  body: string;
};

// Fixed ids, one per day-offset, in a range reserved beside the clock's
// (9001/9002 and 9101–9110): cancellation is "clear our whole range", no
// memory of what a previous sync scheduled. 9201 is today, 9207 is six days
// out.
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

// Every id this module can ever issue — what the sync cancels wholesale before
// scheduling a fresh set.
export function allHabitReminderIds(): number[] {
  const ids: number[] = [];
  for (let d = 0; d < HABIT_REMINDER_DAYS; d++) ids.push(habitReminderId(d));
  return ids;
}

// "Reading", "Reading and Meditation", "Reading, Meditation and Stretching",
// then "Reading, Meditation and 2 more" — a notification body has one line to
// work with, so past three names the tail collapses to a count.
export function habitNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) {
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

// Parses "HH:MM" (24h, what <input type="time"> speaks). Null on anything
// else, so a corrupted stored value degrades to "no reminders" rather than a
// notification at an invented hour.
export function parseReminderTime(
  time: string
): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function habitReminders(
  // Active habits with no completion for `statusDate` — today's body names
  // exactly these.
  uncheckedNames: string[],
  // ALL active habits — what a future day's body names, since a new day
  // starts with everything unchecked.
  activeNames: string[],
  // The YYYY-MM-DD the server computed unchecked-ness FOR (profile timezone).
  // If it isn't the device's today — a stale RSC payload straddling midnight,
  // or profile tz briefly out of step with the device — the unchecked list
  // describes some other day, so day 0 falls back to all active habits: a new
  // day starts all-unchecked, and the next revalidation replaces the guess
  // with the truth.
  statusDate: string,
  // "HH:MM", device-local.
  time: string,
  now: Date
): HabitReminder[] {
  const parsed = parseReminderTime(time);
  if (parsed === null) return [];
  // No habits at all → nothing to remind about, ever. The caller cancels on an
  // empty list.
  if (activeNames.length === 0) return [];

  const deviceToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayNames = statusDate === deviceToday ? uncheckedNames : activeNames;

  const out: HabitReminder[] = [];
  for (let d = 0; d < HABIT_REMINDER_DAYS; d++) {
    const names = d === 0 ? todayNames : activeNames;
    if (names.length === 0) continue;

    // Local Date parts, never UTC: "18:00" means 18:00 on the user's wall
    // clock, and the Date constructor absorbs DST — a reminder three days out
    // across a transition still lands at 18:00 that day.
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + d,
      parsed.hour,
      parsed.minute
    ).getTime();
    // Today with the time already behind us: nothing to say — iOS would fire a
    // past-dated notification immediately, which would read as a bug.
    if (at <= now.getTime()) continue;

    out.push({
      id: habitReminderId(d),
      at,
      title: "Your habits are waiting",
      body: `You haven't checked off ${habitNameList(names)} today — ${names.length > 1 ? "these help" : "it helps"} you grow.`,
    });
  }
  return out;
}
