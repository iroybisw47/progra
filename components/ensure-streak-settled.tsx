"use client";

import { useEffect } from "react";

import { settleMyStreak } from "@/app/actions/streaks";

// One attempt per streak day per tab. Module-level so a client-side navigation
// (which remounts this leaf) can't re-fire it; cleared on failure so the next
// load retries.
let attemptedFor: string | null = null;

// Writes your closed streak days into the ledger, which is what makes them
// final (.claude/plans/streaks.sql, streak_settle). Same shape as
// EnsureSessionCap: the server says how many closed days are still unsettled,
// and the action fires only when that's more than zero, so a normal load costs
// nothing. Failure is silent and retries on the next load.
//
// Mounted where getMyStreak is already read (/me, /feed) rather than in the
// root layout, so the streak RPC isn't added to every page in the app. Until
// it fires, every read computes the unsettled days live, so the numbers are
// right either way; settling only freezes them.
export function EnsureStreakSettled({
  unsettled,
  today,
}: {
  unsettled: number;
  today: string | null;
}) {
  useEffect(() => {
    if (unsettled < 1 || today === null || attemptedFor === today) return;
    attemptedFor = today;
    settleMyStreak()
      .then((r) => {
        if ("error" in r) attemptedFor = null;
      })
      .catch(() => {
        attemptedFor = null;
      });
  }, [unsettled, today]);

  return null;
}
