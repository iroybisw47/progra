"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleHabitCompletion } from "@/app/actions/habits";
import { track } from "@/lib/analytics";
import type { HabitCompletion } from "@/lib/db/habits";

// Optimistic check-off for any day up to today, shared by the habit grids
// (You, Progress Week) and the Manage sheet. The completion set is keyed
// `habitId|date` and seeded from the loaded window, so a tap flips instantly
// and the revalidated props take over once the transition ends.
export function useHabitToggle(completions: HabitCompletion[], today: string) {
  const [, startTransition] = useTransition();
  const [optimisticKeys, addOptimistic] = useOptimistic(
    completions.map((c) => `${c.habitId}|${c.completedOn}`),
    (state: string[], key: string): string[] =>
      state.includes(key) ? state.filter((k) => k !== key) : [...state, key]
  );
  const doneSet = new Set(optimisticKeys);

  function toggle(habitId: string, date: string) {
    if (date > today) return; // future days aren't checkable
    const key = `${habitId}|${date}`;
    // The action toggles, so read the CURRENT state to know which way it went —
    // only checking a habit ON is the activation signal worth counting.
    const checkingOn = !doneSet.has(key);
    startTransition(async () => {
      addOptimistic(key);
      const r = await toggleHabitCompletion(habitId, date);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (checkingOn) track("habit_checked", { habit_id: habitId, backfilled: date !== today });
    });
  }

  return { doneSet, toggle };
}
