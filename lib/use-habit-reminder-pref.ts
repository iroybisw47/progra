"use client";

import { useSyncExternalStore } from "react";

import {
  habitReminderPref,
  subscribeHabitReminderPref,
  type HabitReminderPref,
} from "@/lib/habit-reminder-prefs";

// The device's habit-reminder preference, live.
//
// useSyncExternalStore for the reasons in lib/use-muted.ts: the server can't
// know a localStorage value, and useState + useEffect trips
// react-hooks/set-state-in-effect. The server snapshot is the default (on at
// 18:00), which is also the first client render, so hydration matches.
//
// getServerSnapshot must return a STABLE reference — habitReminderPref()
// builds a fresh object per call, which useSyncExternalStore would treat as a
// change every render. The client snapshot has the same constraint, hence the
// module-level cache keyed on the raw stored string... kept simpler: cache the
// last snapshot and reuse it while the underlying decision is equal.
let lastSnapshot: HabitReminderPref = { enabled: true, time: "18:00" };

function getSnapshot(): HabitReminderPref {
  const next = habitReminderPref();
  if (
    next.enabled !== lastSnapshot.enabled ||
    next.time !== lastSnapshot.time
  ) {
    lastSnapshot = next;
  }
  return lastSnapshot;
}

const SERVER_SNAPSHOT: HabitReminderPref = { enabled: true, time: "18:00" };

export function useHabitReminderPref(): HabitReminderPref {
  return useSyncExternalStore(
    subscribeHabitReminderPref,
    getSnapshot,
    () => SERVER_SNAPSHOT
  );
}
