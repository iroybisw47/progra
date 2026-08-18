import { parseReminderTime } from "@/lib/habit-reminders";

// The daily habit reminder's on/off state and fire time, on THIS device.
//
// Per-device rather than an account setting, for the same reason as
// lib/reminder-prefs.ts: the notification is scheduled on the device, so the
// preference is a statement about this phone — no column, no server action, no
// new prop threaded through the root layout's data fetch.
//
// Unlike the clock pref this one is STANDING, not session-scoped: "remind me
// at 18:00" holds until changed. The default — unset, garbage, storage
// unavailable — is ON at 18:00, a product decision: existing users who granted
// notification permission before this feature existed should start getting it
// without a trip to Settings, and Settings is the way out.

export type HabitReminderPref = {
  enabled: boolean;
  // "HH:MM", 24h — what <input type="time"> speaks.
  time: string;
};

export const DEFAULT_HABIT_REMINDER_TIME = "18:00";

const KEY = "progra.habit-reminder";
const EVENT = "progra:habit-reminder-pref";

// PURE, so the whole decision is testable without a browser — the stored
// string comes in as an argument. Same shape as remindersEnabledFor.
export function habitReminderPrefFor(stored: string | null): HabitReminderPref {
  const fallback: HabitReminderPref = {
    enabled: true,
    time: DEFAULT_HABIT_REMINDER_TIME,
  };
  if (stored === null) return fallback;
  try {
    const parsed = JSON.parse(stored) as { off?: unknown; time?: unknown };
    const time =
      typeof parsed.time === "string" && parseReminderTime(parsed.time) !== null
        ? parsed.time
        : DEFAULT_HABIT_REMINDER_TIME;
    return { enabled: parsed.off !== true, time };
  } catch {
    // A corrupted value must not silence the feature — it isn't what the user
    // chose, and the fix (Settings) is the same screen either way.
    return fallback;
  }
}

export function habitReminderPref(): HabitReminderPref {
  if (typeof window === "undefined") return habitReminderPrefFor(null);
  try {
    return habitReminderPrefFor(window.localStorage.getItem(KEY));
  } catch {
    // Storage throws in private modes. Default rather than off, as above.
    return habitReminderPrefFor(null);
  }
}

export function setHabitReminderPref(pref: HabitReminderPref): void {
  if (typeof window === "undefined") return;
  try {
    // Stored as {off?, time?}: absence means default, so a fresh device and a
    // never-touched device are the same state.
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        ...(pref.enabled ? {} : { off: true }),
        ...(pref.time === DEFAULT_HABIT_REMINDER_TIME
          ? {}
          : { time: pref.time }),
      })
    );
  } catch {
    // Ignore — the change still applies for this page's lifetime via the event.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeHabitReminderPref(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, onChange);
  // Another tab changing it should update this one too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
