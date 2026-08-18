"use client";

import { useEffect } from "react";

import { habitReminders } from "@/lib/habit-reminders";
import { syncHabitReminders } from "@/lib/habit-notifications";
import { HABIT_REMINDERS } from "@/lib/flags";
import { useHabitReminderPref } from "@/lib/use-habit-reminder-pref";
import { useNotificationPermission } from "@/lib/use-notification-permission";

// Keeps the device's scheduled habit reminders in step with today's unchecked
// habits — the habit-family sibling of SyncClockReminders, same shape for the
// same reason: ONE leaf in the root layout, re-rendered with fresh data
// because every habit mutation (toggle, create, archive, rename) ends in
// revalidateHabitSurfaces(), which revalidates the layout. It reacts to every
// path that can change the unchecked set, INCLUDING ones nobody remembered to
// wire up.
//
// syncHabitReminders always cancels the whole reserved id range before
// scheduling, so "reminders off" and "no habits" are just an empty list — no
// separate cancellation path to forget.
export function SyncHabitReminders({
  // "\n"-joined rather than arrays, matching the layout's flat-primitives rule
  // for its leaves: an array prop is a fresh reference every render and would
  // re-run the effect (and re-write the device schedule) on every layout
  // re-render. Habit names come from an <input>, which cannot contain
  // newlines.
  uncheckedNames,
  activeNames,
  // The YYYY-MM-DD the unchecked set was computed for (profile timezone).
  // Null when it couldn't be (signed out) — treated as "cancel everything".
  statusDate,
}: {
  uncheckedNames: string;
  activeNames: string;
  statusDate: string | null;
}) {
  // Permission in the deps so granting it mid-day schedules straight away —
  // the sync bails on a non-granted read, and no habit data changes to
  // retrigger it. The pref in the deps for the same reason: Settings and
  // onboarding write it client-side, with no revalidation involved.
  const permission = useNotificationPermission();
  const pref = useHabitReminderPref();

  useEffect(() => {
    if (!HABIT_REMINDERS) return;

    // "".split("\n") is [""], not [] — guard the empty string.
    const active = activeNames === "" ? [] : activeNames.split("\n");
    const unchecked = uncheckedNames === "" ? [] : uncheckedNames.split("\n");

    const reminders =
      statusDate === null || !pref.enabled
        ? []
        : habitReminders(unchecked, active, statusDate, pref.time, new Date());

    void syncHabitReminders(reminders);
  }, [
    uncheckedNames,
    activeNames,
    statusDate,
    permission,
    pref.enabled,
    pref.time,
  ]);

  return null;
}
