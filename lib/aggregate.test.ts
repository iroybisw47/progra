import { describe, expect, it } from "vitest";

import { aggregateRange, aggregateRangeByGoal } from "@/lib/aggregate";
import {
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
} from "@/lib/dates";
import type { DayEvent } from "@/lib/db/calendar-events";
import type { Session } from "@/lib/storage";

const HOUR = 3_600_000;
let idc = 0;

function sess(over: Partial<Session> = {}): Session {
  return {
    id: `s${idc++}`,
    categoryId: "c1",
    sessionPlanId: null,
    taskName: "t",
    startedAt: 0,
    endedAt: null,
    pausedMs: 0,
    pausedSince: null,
    ...over,
  };
}

// An ended session of `hours` length whose end instant is `endMs`.
function ended(endMs: number, hours = 1, over: Partial<Session> = {}): Session {
  return sess({ startedAt: endMs - hours * HOUR, endedAt: endMs, ...over });
}

const JUN_START = startOfMonth(new Date(2026, 5, 1)).getTime();
const JUN_END = endOfMonth(new Date(2026, 5, 1)).getTime();

describe("aggregateRange (by category)", () => {
  it("attributes worked time by end instant into its category", () => {
    const s = ended(new Date(2026, 5, 10, 12).getTime(), 2);
    const r = aggregateRange([s], [], JUN_START, JUN_END, JUN_END);
    expect(r.total).toBe(2 * HOUR);
    expect(r.perCategory.get("c1")).toBe(2 * HOUR);
  });

  it("uses worked time, not wall-clock span (excludes pause)", () => {
    const end = new Date(2026, 5, 10, 12).getTime();
    const s = sess({ startedAt: end - 3 * HOUR, endedAt: end, pausedMs: HOUR });
    const r = aggregateRange([s], [], JUN_START, JUN_END, JUN_END);
    expect(r.perCategory.get("c1")).toBe(2 * HOUR);
  });

  it("buckets uncategorized sessions and events under null", () => {
    const s = ended(new Date(2026, 5, 10, 12).getTime(), 1, { categoryId: null });
    const ev: DayEvent = {
      id: "e1",
      title: "x",
      startMs: new Date(2026, 5, 11, 9).getTime(),
      endMs: new Date(2026, 5, 11, 10).getTime(),
      category: null,
      source: "uncategorized",
    };
    const r = aggregateRange([s], [ev], JUN_START, JUN_END, JUN_END);
    expect(r.perCategory.get(null)).toBe(2 * HOUR);
    expect(r.total).toBe(2 * HOUR);
  });

  it("excludes sessions whose end falls outside the window", () => {
    const may = ended(new Date(2026, 4, 31, 12).getTime());
    expect(aggregateRange([may], [], JUN_START, JUN_END, JUN_END).total).toBe(0);
  });
});

describe("aggregateRangeByGoal", () => {
  const planToGoal = new Map([
    ["p1", "g1"],
    ["p2", "g2"],
  ]);

  it("maps sessions to goals via plan; everything else is untracked", () => {
    const d = new Date(2026, 5, 10, 12).getTime();
    const rows = [
      ended(d, 2, { sessionPlanId: "p1" }),
      ended(d, 1, { sessionPlanId: "p2" }),
      ended(d, 3, { sessionPlanId: null }), // no plan
      ended(d, 1, { sessionPlanId: "pX" }), // unknown plan
    ];
    const r = aggregateRangeByGoal(rows, planToGoal, JUN_START, JUN_END, JUN_END);
    expect(r.perGoal.get("g1")).toBe(2 * HOUR);
    expect(r.perGoal.get("g2")).toBe(1 * HOUR);
    expect(r.untracked).toBe(4 * HOUR);
    expect(r.total).toBe(7 * HOUR);
  });
});

describe("month boundary: a straddling session counts once, by end instant", () => {
  it("a session ending Jun 1 counts in June, never May", () => {
    const s = sess({
      startedAt: new Date(2026, 4, 31, 23, 0).getTime(), // May 31 23:00
      endedAt: new Date(2026, 5, 1, 0, 30).getTime(), // Jun 1 00:30 (1.5h)
    });
    const mayStart = startOfMonth(new Date(2026, 4, 1)).getTime();
    const mayEnd = endOfMonth(new Date(2026, 4, 1)).getTime();
    expect(aggregateRange([s], [], mayStart, mayEnd, mayEnd).total).toBe(0);
    expect(aggregateRange([s], [], JUN_START, JUN_END, JUN_END).total).toBe(
      1.5 * HOUR
    );
  });
});

describe("reconciliation: a year equals the sum of its 12 months", () => {
  it("every session lands in exactly one month; totals match the year", () => {
    const planToGoal = new Map([
      ["p1", "g1"],
      ["p2", "g2"],
    ]);
    const sessions: Session[] = [
      ended(new Date(2026, 0, 1, 0, 30).getTime(), 0.5, { sessionPlanId: "p1" }),
      ended(new Date(2026, 0, 31, 23, 30).getTime(), 1, { sessionPlanId: "p2" }),
      // starts in Jan, ENDS Feb 1 → belongs to February:
      ended(new Date(2026, 1, 1, 0, 10).getTime(), 1, { sessionPlanId: "p1" }),
      ended(new Date(2026, 5, 15, 12).getTime(), 2, { sessionPlanId: null }),
      ended(new Date(2026, 11, 31, 23, 59).getTime(), 1.5, { sessionPlanId: "p2" }),
    ];

    const yStart = startOfYear(new Date(2026, 0, 1)).getTime();
    const yEnd = endOfYear(new Date(2026, 0, 1)).getTime();
    const year = aggregateRangeByGoal(sessions, planToGoal, yStart, yEnd, yEnd);

    const monthPerGoal = new Map<string, number>();
    let monthUntracked = 0;
    for (let m = 0; m < 12; m++) {
      const mStart = startOfMonth(new Date(2026, m, 1)).getTime();
      const mEnd = endOfMonth(new Date(2026, m, 1)).getTime();
      const r = aggregateRangeByGoal(sessions, planToGoal, mStart, mEnd, mEnd);
      for (const [g, ms] of r.perGoal) {
        monthPerGoal.set(g, (monthPerGoal.get(g) ?? 0) + ms);
      }
      monthUntracked += r.untracked;
    }

    expect(monthPerGoal.get("g1")).toBe(year.perGoal.get("g1"));
    expect(monthPerGoal.get("g2")).toBe(year.perGoal.get("g2"));
    expect(monthUntracked).toBe(year.untracked);

    const sumOfMonths =
      monthUntracked + [...monthPerGoal.values()].reduce((a, b) => a + b, 0);
    expect(sumOfMonths).toBe(year.total);
  });
});
