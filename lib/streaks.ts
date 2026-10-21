// Streaks: the rules, pure (.claude/plans/streaks.md). Nothing here reads the
// clock or the database; `now` and the rows come in as arguments, so every rule
// is a unit test (lib/streaks.test.ts) and the same fixtures
// (lib/streaks.fixtures.json) prove the SQL twin in .claude/plans/streaks.sql.
//
// The rules, once:
//
//   - A streak day is the user's local calendar day running 04:00 → 04:00, in
//     their STORED timezone. Anything between midnight and 4am belongs to the
//     day before.
//   - A day is active when it has a session that STARTED in it with at least
//     5 minutes of worked time (sessionWorkedMs: pauses out, auto-ended = 0),
//     or a habit tick MADE in it for that day. A tick made between midnight and
//     4am counts whether it's for the calendar day before or the one just
//     begun; a backfill of an earlier day never counts.
//   - Shared-active is the same over shared rows only (session not private,
//     habit not private). It's what a friend is shown, so a streak number never
//     reveals private activity.
//   - Walking forward from Day One: an active day adds 1. A missed closed day
//     uses a freeze when the run is alive and the month has one left; a freeze
//     bridges without adding. Otherwise the run resets.
//   - A closed day (past its 04:00 close) can be settled into the ledger, and a
//     settled day is final: a later delete, uncheck or backfill doesn't move it.

import { addDaysISO, isoDateInTimeZone, zonedWallClockMs } from "@/lib/dates";
import { sessionWorkedMs, type SessionTiming } from "@/lib/session";
import {
  FREEZES_PER_MONTH,
  STREAK_CUTOFF_HOUR,
  STREAK_MILESTONES,
  STREAK_MIN_WORKED_MS,
} from "@/lib/streaks-config";

export type StreakSession = SessionTiming & { isPrivate: boolean };

// One habit_completions row: the day it's for, when it was made, and whether
// its habit is private.
export type StreakTick = {
  completedOn: string;
  createdAt: number;
  isPrivate: boolean;
};

export type DayFact = { active: boolean; sharedActive: boolean };

// A settled streak_days row. Final once written.
export type LedgerDay = {
  day: string;
  active: boolean;
  sharedActive: boolean;
  freeze: boolean;
};

// One closed day as the walk decided it, settled or not.
export type WalkedDay = LedgerDay & { settled: boolean };

export type StreakState =
  | { state: "prelaunch"; launch: string | null }
  | {
      state: "live";
      launch: string;
      today: string;
      current: number;
      longest: number;
      // Today hasn't counted yet and there's a run to keep.
      atRisk: boolean;
      todayActive: boolean;
      // Left in today's calendar month.
      freezesLeft: number;
      freezeDays: string[];
      // Over shared activity only, the friend view.
      shared: { current: number; longest: number };
      // Closed days since Day One not in the ledger yet.
      unsettled: number;
      milestone: number | null;
    };

// The streak day an instant belongs to in `tz`: its local date, or the one
// before when it falls before 04:00. Against the real 04:00 instant
// (zonedWallClockMs), not "minus 4 hours", so DST days come out right.
export function streakDayOf(ms: number, tz: string): string {
  const date = isoDateInTimeZone(ms, tz);
  return ms < zonedWallClockMs(date, STREAK_CUTOFF_HOUR, tz)
    ? addDaysISO(date, -1)
    : date;
}

// The instant a streak day closes: 04:00 local the morning after.
export function closeMs(day: string, tz: string): number {
  return zonedWallClockMs(addDaysISO(day, 1), STREAK_CUTOFF_HOUR, tz);
}

export function sessionQualifies(s: SessionTiming, now: number): boolean {
  return sessionWorkedMs(s, now) >= STREAK_MIN_WORKED_MS;
}

// The streak day a tick counts for, or null when it's a backfill. A tick made
// in streak day D counts for D when it's for D, or for the calendar day after
// (made between midnight and 4am, when the habit list already shows tomorrow's
// date as today).
export function tickDay(tick: StreakTick, tz: string): string | null {
  const day = streakDayOf(tick.createdAt, tz);
  return tick.completedOn === day || tick.completedOn === addDaysISO(day, 1)
    ? day
    : null;
}

export function dayFacts(input: {
  sessions: readonly StreakSession[];
  ticks: readonly StreakTick[];
  tz: string;
  now: number;
}): Map<string, DayFact> {
  const facts = new Map<string, DayFact>();
  const mark = (day: string, shared: boolean) => {
    const f = facts.get(day) ?? { active: false, sharedActive: false };
    f.active = true;
    if (shared) f.sharedActive = true;
    facts.set(day, f);
  };
  for (const s of input.sessions) {
    if (sessionQualifies(s, input.now)) {
      mark(streakDayOf(s.startedAt, input.tz), !s.isPrivate);
    }
  }
  for (const t of input.ticks) {
    const day = tickDay(t, input.tz);
    if (day !== null) mark(day, !t.isPrivate);
  }
  return facts;
}

export function milestoneFor(n: number): number | null {
  let hit: number | null = null;
  for (const m of STREAK_MILESTONES) if (n >= m) hit = m;
  return hit;
}

// Every closed day from `start` to the day before `today`, oldest first, each
// taken from the ledger when settled and decided from the facts when not.
// This is also what settling writes, so the SQL's settle_streak must produce
// exactly these rows (the harness checks).
export function walkDays(input: {
  facts: ReadonlyMap<string, DayFact>;
  ledger: readonly LedgerDay[];
  start: string;
  today: string;
}): WalkedDay[] {
  const ledger = new Map(input.ledger.map((d) => [d.day, d]));
  const used = new Map<string, number>();
  const out: WalkedDay[] = [];
  let run = 0;
  for (let day = input.start; day < input.today; day = addDaysISO(day, 1)) {
    const settled = ledger.get(day);
    let row: LedgerDay;
    if (settled) {
      row = settled;
    } else {
      const f = input.facts.get(day);
      const active = f?.active ?? false;
      const month = day.slice(0, 7);
      const freeze =
        !active && run > 0 && (used.get(month) ?? 0) < FREEZES_PER_MONTH;
      row = { day, active, sharedActive: f?.sharedActive ?? false, freeze };
    }
    if (row.freeze) {
      const month = day.slice(0, 7);
      used.set(month, (used.get(month) ?? 0) + 1);
    }
    run = row.active ? run + 1 : row.freeze ? run : 0;
    out.push({ ...row, settled: settled !== undefined });
  }
  return out;
}

// A run over walked days: +1 on a counted day, held on a freeze, reset
// otherwise. `counts` picks which days count (all activity, or shared only).
function runs(
  days: readonly WalkedDay[],
  counts: (d: WalkedDay) => boolean,
  todayCounts: boolean
): { current: number; longest: number } {
  let run = 0;
  let longest = 0;
  for (const d of days) {
    run = counts(d) ? run + 1 : d.freeze ? run : 0;
    longest = Math.max(longest, run);
  }
  if (todayCounts) run += 1;
  return { current: run, longest: Math.max(longest, run) };
}

export function streakState(input: {
  facts: ReadonlyMap<string, DayFact>;
  ledger: readonly LedgerDay[];
  tz: string;
  now: number;
  launch: string | null;
  // The person's first streak day when they joined after Day One, so the walk
  // (and the ledger) starts there rather than at a launch they weren't around for.
  from?: string | null;
}): StreakState {
  const { launch, from } = input;
  const today = streakDayOf(input.now, input.tz);
  if (launch === null || today < launch) return { state: "prelaunch", launch };

  const days = walkDays({
    facts: input.facts,
    ledger: input.ledger,
    start: from && from > launch ? from : launch,
    today,
  });
  const todayFact = input.facts.get(today);
  const todayActive = todayFact?.active ?? false;
  const full = runs(days, (d) => d.active, todayActive);
  const shared = runs(days, (d) => d.sharedActive, todayFact?.sharedActive ?? false);

  const month = today.slice(0, 7);
  const freezeDays = days.filter((d) => d.freeze).map((d) => d.day);
  const usedThisMonth = freezeDays.filter((d) => d.startsWith(month)).length;

  return {
    state: "live",
    launch,
    today,
    current: full.current,
    longest: full.longest,
    atRisk: !todayActive && full.current > 0,
    todayActive,
    freezesLeft: Math.max(0, FREEZES_PER_MONTH - usedThisMonth),
    freezeDays,
    shared,
    unsettled: days.filter((d) => !d.settled).length,
    milestone: milestoneFor(full.current),
  };
}
