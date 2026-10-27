"use client";

import { useEffect } from "react";

import { cancelHabitReminders } from "@/lib/habit-notifications";

// Cancels the daily habit reminders an older build left queued on this device.
//
// The reminder was retired 2026-10-21 in favour of the streak reminder, but
// every sync of it scheduled a week of one-shot local notifications ahead, and
// iOS fires those whether or not the code that wrote them still exists. So
// the first launch of this build clears the range. A device that never opens
// again fires out its last week and then has nothing left, which is why this
// leaf can be deleted (with lib/habit-notifications.ts) a week or two after
// it ships.
//
// Mounted ungated in the root layout: the queue belongs to the device, not to
// whoever is signed in. Off-native it's a no-op.
export function ClearHabitReminders() {
  useEffect(() => {
    if (cleared) return;
    cleared = true;
    void cancelHabitReminders();
  }, []);

  return null;
}

// Module scope, not state: once per page life, not once per remount.
let cleared = false;
