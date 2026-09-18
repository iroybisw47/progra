import { describe, expect, it } from "vitest";

import {
  daysBetween,
  goalCompletionFrom,
  habitCompletionFrom,
  weekMondaysInRange,
} from "@/lib/history-stats";
import type { Goal } from "@/lib/db/goals";
import type { Habit, HabitCompletion as HabitCheck } from "@/lib/db/habits";
import type { Session } from "@/lib/storage";

const HOUR = 3_600_000;
const TZ = "UTC";
let idc = 0;

function sess(over: Partial<Session> = {}): Session {
  return {
    plannedWorkMs: null,
    workIntervalMs: null,
    breakMs: null,
    onBreak: false,
    breaksTaken: 0,
    planReviewedAt: null,
    id: `s${idc++}`,
    categoryId: null,
    goalId: "g1",
    taskName: "t",
    startedAt: 0,
    endedAt: null,
    pausedMs: 0,
    pausedSince: null,
    isPrivate: false,
    photoPath: null,
    autoEndedAt: null,
    autoEndReviewedAt: null,
    ...over,
  };
}

// A session of `hours` ending at the given UTC instant.
function ended(endISO: string, hours: number, goalId = "g1"): Session {
  const end = Date.parse(endISO);
  return sess({ goalId, startedAt: end - hours * HOUR, endedAt: end });
}

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    title: "Thesis",
    description: null,
    weeklyQuotaHours: 5,
    status: "active",
    createdAt: Date.parse("2020-01-01T00:00:00Z"),
    color: "#395AA0",
    isPrivate: false,
    ...over,
  };
}

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Wake by 7",
    color: "#D6A728",
    createdAt: Date.parse("2020-01-01T00:00:00Z"),
    archivedAt: null,
    isPrivate: false,
    ...over,
  };
}

function check(habitId: string, completedOn: string): HabitCheck {
  return { id: `c${idc++}`, habitId, completedOn };
}

describe("weekMondaysInRange", () => {
  it("lists every Monday overlapping the window", () => {
    // 1 Jun 2026 is a Monday; 30 Jun is a Tuesday.
    const weeks = weekMondaysInRange(
      Date.parse("2026-06-01T00:00:00Z"),
      Date.parse("2026-06-30T23:59:59Z"),
      TZ,
      Date.parse("2027-01-01T00:00:00Z")
    );
    expect(weeks).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
      "2026-06-29",
    ]);
  });

  it("snaps a mid-week window start back to its Monday", () => {
    const weeks = weekMondaysInRange(
      Date.parse("2026-06-03T00:00:00Z"), // Wednesday
      Date.parse("2026-06-10T00:00:00Z"),
      TZ,
      Date.parse("2027-01-01T00:00:00Z")
    );
    expect(weeks).toEqual(["2026-06-01", "2026-06-08"]);
  });

  it("stops at the week containing now, so a live window counts no future weeks", () => {
    const weeks = weekMondaysInRange(
      Date.parse("2026-06-01T00:00:00Z"),
      Date.parse("2026-06-30T23:59:59Z"),
      TZ,
      Date.parse("2026-06-10T12:00:00Z") // mid-June
    );
    expect(weeks).toEqual(["2026-06-01", "2026-06-08"]);
  });

  it("is empty for a window that hasn't started", () => {
    expect(
      weekMondaysInRange(
        Date.parse("2027-01-01T00:00:00Z"),
        Date.parse("2027-12-31T00:00:00Z"),
        TZ,
        Date.parse("2026-06-10T00:00:00Z")
      )
    ).toEqual([]);
  });
});

describe("daysBetween", () => {
  it("is inclusive of both ends", () => {
    expect(daysBetween("2026-06-01", "2026-06-01")).toBe(1);
    expect(daysBetween("2026-06-01", "2026-06-30")).toBe(30);
  });

  it("spans month and year boundaries", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(2);
  });
});

describe("goalCompletionFrom", () => {
  // June 2026 starts on a Monday; its Mondays are 1, 8, 15, 22 and 29.
  const JUNE_START = Date.parse("2026-06-01T00:00:00Z");
  const JUNE_END = Date.parse("2026-06-30T23:59:59.999Z");
  // Single week (Mon 1 – Sun 7 Jun) and two weeks (Mon 1 – Sun 14 Jun).
  const WEEK1_END = Date.parse("2026-06-07T23:59:59.999Z");
  const WEEK2_END = Date.parse("2026-06-14T23:59:59.999Z");
  const AFTER = Date.parse("2026-07-15T00:00:00Z");

  const win = (endMs: number) => ({
    startMs: JUNE_START,
    endMs,
    tz: TZ,
    now: AFTER,
  });

  // The headline behaviour: a week is scored on how close it got, not on
  // whether it cleared the bar. Half the quota used to score exactly zero.
  it("gives a week partial credit for how close it got", () => {
    const out = goalCompletionFrom(
      [goal({ weeklyQuotaHours: 20 })],
      [ended("2026-06-02T10:00:00Z", 10)],
      win(WEEK1_END)
    );
    expect(out.perGoal[0].rate).toBeCloseTo(0.5);
  });

  it("caps a week at 100% so overshoot can't bank credit", () => {
    const out = goalCompletionFrom(
      [goal({ weeklyQuotaHours: 20 })],
      [ended("2026-06-02T10:00:00Z", 40)],
      win(WEEK1_END)
    );
    expect(out.perGoal[0].rate).toBe(1);
    expect(out.perGoal[0].countedMs).toBe(20 * HOUR);
  });

  it("averages a full week and an empty one to 50%", () => {
    const out = goalCompletionFrom(
      [goal({ weeklyQuotaHours: 5 })],
      [ended("2026-06-02T10:00:00Z", 5)], // week of 1 Jun only
      win(WEEK2_END)
    );
    expect(out.perGoal[0].weeksEligible).toBe(2);
    expect(out.perGoal[0].rate).toBeCloseTo(0.5);
  });

  it("averages a full week and a half week to 75%", () => {
    const out = goalCompletionFrom(
      [goal({ weeklyQuotaHours: 4 })],
      [
        ended("2026-06-02T10:00:00Z", 4), // week of 1 Jun → full
        ended("2026-06-09T10:00:00Z", 2), // week of 8 Jun → half
      ],
      win(WEEK2_END)
    );
    expect(out.perGoal[0].rate).toBeCloseTo(0.75);
  });

  it("a 40h week beside an empty one does not read as complete", () => {
    const out = goalCompletionFrom(
      [goal({ weeklyQuotaHours: 20 })],
      [ended("2026-06-02T10:00:00Z", 40)],
      win(WEEK2_END)
    );
    // Uncapped this would be 40h/40h = 100%; capped it's one week of two.
    expect(out.perGoal[0].rate).toBeCloseTo(0.5);
    expect(out.perGoal[0].countedMs).toBe(20 * HOUR);
    expect(out.perGoal[0].targetMs).toBe(40 * HOUR);
  });

  // The row prints countedMs/targetMs beside the percentage, so they must never
  // tell different stories.
  it("keeps counted hours, target and rate consistent", () => {
    const sessions = [
      ended("2026-06-02T10:00:00Z", 3), // week of 1 Jun
      ended("2026-06-04T10:00:00Z", 2), // week of 1 Jun → 5h, full
      ended("2026-06-09T10:00:00Z", 4), // week of 8 Jun → 4h of 5
    ];
    const out = goalCompletionFrom([goal()], sessions, win(JUNE_END));
    const g = out.perGoal[0];
    expect(out.weeksElapsed).toBe(5);
    expect(g.weeksEligible).toBe(5);
    expect(g.countedMs).toBe(9 * HOUR);
    expect(g.targetMs).toBe(25 * HOUR);
    expect(g.rate).toBeCloseTo(g.countedMs / g.targetMs);
    expect(g.rate).toBeCloseTo(0.36);
  });

  it("weights the overall rate by weeks, not by goal count", () => {
    const old = goal({ id: "g1", weeklyQuotaHours: 5 });
    const fresh = goal({
      id: "g2",
      weeklyQuotaHours: 5,
      createdAt: Date.parse("2026-06-08T09:00:00Z"), // week of 8 Jun
    });
    const out = goalCompletionFrom(
      [old, fresh],
      [
        ended("2026-06-02T10:00:00Z", 5, "g1"), // g1: week 1 full, week 2 empty
        ended("2026-06-09T10:00:00Z", 5, "g2"), // g2: its only week, full
      ],
      win(WEEK2_END)
    );
    // g1 rate .5 over 2 weeks, g2 rate 1 over 1 week. A mean of the two rates
    // would be .75; weighting by weeks gives 2 credits over 3 eligible weeks.
    expect(out.overallRate).toBeCloseTo(2 / 3);
  });

  it("buckets a session by its END, not its start", () => {
    // Starts Sunday 7 Jun 23:00, ends Monday 8 Jun 02:00 — so under
    // end-attribution it falls in the week of 8 Jun, which is outside a window
    // that stops on the 7th. Start-based bucketing would have counted it.
    const overnight = sess({
      startedAt: Date.parse("2026-06-07T23:00:00Z"),
      endedAt: Date.parse("2026-06-08T02:00:00Z"),
    });
    const out = goalCompletionFrom(
      [goal({ weeklyQuotaHours: 3 })],
      [overnight],
      win(WEEK1_END)
    );
    expect(out.perGoal[0].rate).toBe(0);
  });

  it("only measures a goal from the week it was created", () => {
    const late = goal({
      id: "g2",
      createdAt: Date.parse("2026-06-16T09:00:00Z"), // week of 15 Jun
    });
    const out = goalCompletionFrom([late], [], {
      startMs: JUNE_START,
      endMs: JUNE_END,
      tz: TZ,
      now: AFTER,
    });
    // June has 5 Mondays; the goal existed for the last 3 of them.
    expect(out.weeksElapsed).toBe(5);
    expect(out.perGoal[0].weeksEligible).toBe(3);
  });

  it("drops goals created after the window entirely", () => {
    const future = goal({ createdAt: Date.parse("2026-09-01T00:00:00Z") });
    const out = goalCompletionFrom([future], [], {
      startMs: JUNE_START,
      endMs: JUNE_END,
      tz: TZ,
      now: AFTER,
    });
    expect(out.perGoal).toEqual([]);
    expect(out.overallRate).toBe(0);
  });

  it("ignores goals with no quota and sessions with no goal", () => {
    const out = goalCompletionFrom(
      [goal({ weeklyQuotaHours: 0 })],
      [ended("2026-06-02T10:00:00Z", 8, "g1")],
      { startMs: JUNE_START, endMs: JUNE_END, tz: TZ, now: AFTER }
    );
    expect(out.perGoal).toEqual([]);
  });

  it("gives a capped auto-ended session zero credit", () => {
    const capped = sess({
      startedAt: Date.parse("2026-06-02T00:00:00Z"),
      endedAt: Date.parse("2026-06-02T10:00:00Z"),
      autoEndedAt: Date.parse("2026-06-02T10:00:00Z"),
    });
    const out = goalCompletionFrom([goal()], [capped], win(JUNE_END));
    expect(out.perGoal[0].rate).toBe(0);
    expect(out.perGoal[0].countedMs).toBe(0);
  });

  // The UI's "Delete" only sets status = 'archived', so a goal the user thinks
  // they deleted must not keep being scored.
  it("excludes archived goals entirely", () => {
    const archived = goal({ id: "g3", status: "archived", weeklyQuotaHours: 2 });
    const out = goalCompletionFrom(
      [archived],
      [ended("2026-06-02T10:00:00Z", 2, "g3")],
      { startMs: JUNE_START, endMs: JUNE_END, tz: TZ, now: AFTER }
    );
    expect(out.perGoal).toEqual([]);
  });

  it("does not let an archived goal drag the overall rate down", () => {
    const active = goal({ id: "g1", weeklyQuotaHours: 1 });
    const archived = goal({ id: "g3", status: "archived", weeklyQuotaHours: 99 });
    const sessions = [
      ended("2026-06-02T10:00:00Z", 2, "g1"),
      ended("2026-06-09T10:00:00Z", 2, "g1"),
      ended("2026-06-16T10:00:00Z", 2, "g1"),
      ended("2026-06-23T10:00:00Z", 2, "g1"),
      ended("2026-06-30T10:00:00Z", 2, "g1"),
    ];
    const out = goalCompletionFrom([active, archived], sessions, {
      startMs: JUNE_START,
      endMs: JUNE_END,
      tz: TZ,
      now: AFTER,
    });
    expect(out.perGoal).toHaveLength(1);
    expect(out.overallRate).toBe(1);
  });
});

describe("habitCompletionFrom", () => {
  const opts = {
    startISO: "2026-06-01",
    endISO: "2026-06-30",
    todayISO: "2026-07-15",
    tz: TZ,
    includeCalendar: false,
  };

  it("rates a habit over the days it existed in the window", () => {
    const checks = [
      check("h1", "2026-06-01"),
      check("h1", "2026-06-02"),
      check("h1", "2026-06-03"),
    ];
    const out = habitCompletionFrom([habit()], checks, opts);
    expect(out.perHabit[0].rate).toBeCloseTo(3 / 30);
    expect(out.overallRate).toBeCloseTo(3 / 30);
  });

  it("does not punish a habit for days before it was created", () => {
    const mid = habit({ createdAt: Date.parse("2026-06-21T00:00:00Z") });
    const checks = [check("h1", "2026-06-21"), check("h1", "2026-06-22")];
    const out = habitCompletionFrom([mid], checks, opts);
    // 21–30 June is 10 days, not 30.
    expect(out.perHabit[0].rate).toBeCloseTo(2 / 10);
  });

  // Same rule as goals: the UI's "Delete" only stamps archived_at.
  it("excludes archived habits entirely", () => {
    const archived = habit({ archivedAt: Date.parse("2026-06-10T00:00:00Z") });
    const out = habitCompletionFrom([archived], [check("h1", "2026-06-05")], opts);
    expect(out.perHabit).toEqual([]);
    expect(out.overallRate).toBe(0);
  });

  it("keeps archived habits out of the calendar's per-day totals", () => {
    const out = habitCompletionFrom(
      [habit(), habit({ id: "h2", archivedAt: Date.parse("2026-06-10T00:00:00Z") })],
      [check("h1", "2026-06-02"), check("h2", "2026-06-02")],
      { ...opts, todayISO: "2026-06-03", includeCalendar: true }
    );
    // Only h1 counts — "of N" and the fill scale must both ignore h2.
    expect(out.perHabit).toHaveLength(1);
    expect(out.calendar[1]).toEqual({ date: "2026-06-02", done: 1, total: 1 });
  });

  it("caps the window at today for a month still in progress", () => {
    const out = habitCompletionFrom([habit()], [check("h1", "2026-06-01")], {
      ...opts,
      todayISO: "2026-06-10",
    });
    expect(out.perHabit[0].rate).toBeCloseTo(1 / 10);
  });

  it("never exceeds 100% when a check predates the habit", () => {
    const mid = habit({ createdAt: Date.parse("2026-06-29T00:00:00Z") });
    const checks = [
      check("h1", "2026-06-01"), // stray row from before it existed
      check("h1", "2026-06-29"),
      check("h1", "2026-06-30"),
    ];
    const out = habitCompletionFrom([mid], checks, opts);
    expect(out.perHabit[0].rate).toBeCloseTo(2 / 2);
    expect(out.perHabit[0].rate).toBeLessThanOrEqual(1);
  });

  it("builds a per-day calendar that stops at today", () => {
    const out = habitCompletionFrom(
      [habit(), habit({ id: "h2", name: "Gym" })],
      [check("h1", "2026-06-02"), check("h2", "2026-06-02")],
      { ...opts, todayISO: "2026-06-03", includeCalendar: true }
    );
    expect(out.calendar).toHaveLength(3); // 1, 2, 3 June
    expect(out.calendar[0]).toEqual({ date: "2026-06-01", done: 0, total: 2 });
    expect(out.calendar[1]).toEqual({ date: "2026-06-02", done: 2, total: 2 });
    expect(out.calendar.at(-1)?.date).toBe("2026-06-03");
  });

  it("scales a calendar day's total to the habits alive that day", () => {
    const out = habitCompletionFrom(
      [habit(), habit({ id: "h2", createdAt: Date.parse("2026-06-03T00:00:00Z") })],
      [],
      { ...opts, todayISO: "2026-06-03", includeCalendar: true }
    );
    expect(out.calendar[0].total).toBe(1); // only h1 existed on 1 June
    expect(out.calendar[2].total).toBe(2);
  });

  it("omits the calendar unless asked for it", () => {
    const out = habitCompletionFrom([habit()], [], opts);
    expect(out.calendar).toEqual([]);
  });

  it("returns empties when there are no habits", () => {
    expect(habitCompletionFrom([], [], opts)).toEqual({
      overallRate: 0,
      perHabit: [],
      calendar: [],
    });
  });
});
