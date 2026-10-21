import { describe, expect, it } from "vitest";

import fixtures from "@/lib/streaks.fixtures.json";
import {
  closeMs,
  dayFacts,
  milestoneFor,
  sessionQualifies,
  streakDayOf,
  streakState,
  tickDay,
  walkDays,
  type LedgerDay,
  type StreakSession,
  type StreakTick,
} from "@/lib/streaks";
import { addDaysISO } from "@/lib/dates";

const MIN = 60_000;
const LA = "America/Los_Angeles";
const ms = (iso: string) => Date.parse(iso);

type FixtureCase = (typeof fixtures.cases)[number];

// The JSON's compact rows → the shapes lib/streaks.ts takes. The SQL harness
// does the same mapping into sessions/habit_completions rows.
function sessionsOf(c: FixtureCase): StreakSession[] {
  return c.sessions.map((s) => {
    const row = s as {
      start: string;
      end: string | null;
      pausedMin?: number;
      autoEnded?: boolean;
      private?: boolean;
    };
    return {
      startedAt: ms(row.start),
      endedAt: row.end === null ? null : ms(row.end),
      pausedMs: (row.pausedMin ?? 0) * MIN,
      pausedSince: null,
      autoEndedAt: row.autoEnded ? ms(row.end!) : null,
      isPrivate: row.private ?? false,
    };
  });
}

function ticksOf(c: FixtureCase): StreakTick[] {
  return c.ticks.map((t) => {
    const row = t as { on: string; at: string; private?: boolean };
    return {
      completedOn: row.on,
      createdAt: ms(row.at),
      isPrivate: row.private ?? false,
    };
  });
}

function stateOf(c: FixtureCase) {
  const now = ms(c.now);
  return streakState({
    facts: dayFacts({ sessions: sessionsOf(c), ticks: ticksOf(c), tz: c.tz, now }),
    ledger: ((c as { ledger?: LedgerDay[] }).ledger ?? []) as LedgerDay[],
    tz: c.tz,
    now,
    launch: c.launch,
    from: (c as { from?: string }).from ?? null,
  });
}

describe("streak day (shared fixtures)", () => {
  for (const d of fixtures.days) {
    it(`${d.tz} ${d.why} → ${d.day}`, () => {
      expect(streakDayOf(ms(d.at), d.tz)).toBe(d.day);
    });
  }
});

describe("streak state (shared fixtures)", () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const s = stateOf(c);
      expect(s.state).toBe(c.expect.state);
      if (s.state === "live") {
        // Only what the fixture states; the SQL twin is held to the same keys.
        const picked = Object.fromEntries(
          Object.keys(c.expect).map((k) => [k, s[k as keyof typeof s]])
        );
        expect(picked).toEqual(c.expect);
      }
    });
  }
});

describe("closeMs", () => {
  it("is 4am the morning after, on the spring-forward night", () => {
    // 2026-03-08 04:00 PDT (UTC-7).
    expect(closeMs("2026-03-07", LA)).toBe(Date.UTC(2026, 2, 8, 11));
  });
  it("is 4am the morning after, on the fall-back night", () => {
    // 2026-11-01 04:00 PST (UTC-8).
    expect(closeMs("2026-10-31", LA)).toBe(Date.UTC(2026, 10, 1, 12));
  });
  it("is 4am in London across its fall-back", () => {
    expect(closeMs("2026-10-24", "Europe/London")).toBe(Date.UTC(2026, 9, 25, 4));
  });
  it("agrees with streakDayOf at the boundary", () => {
    const close = closeMs("2026-10-21", "Asia/Kolkata");
    expect(streakDayOf(close - 1, "Asia/Kolkata")).toBe("2026-10-21");
    expect(streakDayOf(close, "Asia/Kolkata")).toBe("2026-10-22");
  });
});

describe("sessionQualifies", () => {
  const base = { startedAt: 0, pausedMs: 0, pausedSince: null };
  it("counts a live pause against the running session", () => {
    // 10 minutes in, paused for the last 6.
    expect(
      sessionQualifies({ ...base, endedAt: null, pausedSince: 4 * MIN }, 10 * MIN)
    ).toBe(false);
  });
  it("uses the ended row's own times, not now", () => {
    expect(sessionQualifies({ ...base, endedAt: 5 * MIN }, 999 * MIN)).toBe(true);
  });
});

describe("tickDay", () => {
  it("is null for a tick made two days after the day it's for", () => {
    expect(
      tickDay(
        { completedOn: "2026-10-21", createdAt: ms("2026-10-23T17:00:00Z"), isPrivate: false },
        LA
      )
    ).toBeNull();
  });
  it("is null for yesterday's box ticked after 4am", () => {
    expect(
      tickDay(
        { completedOn: "2026-10-21", createdAt: ms("2026-10-22T11:00:00Z"), isPrivate: false },
        LA
      )
    ).toBeNull();
  });
});

describe("dayFacts", () => {
  it("unchecking (the row gone) leaves an open day empty", () => {
    const facts = dayFacts({ sessions: [], ticks: [], tz: LA, now: ms("2026-10-21T19:00:00Z") });
    expect(facts.size).toBe(0);
  });
});

describe("walkDays", () => {
  it("counts a ledgered freeze toward the month's two", () => {
    const days = walkDays({
      facts: new Map([
        ["2026-10-21", { active: true, sharedActive: true }],
        ["2026-10-23", { active: true, sharedActive: true }],
      ]),
      ledger: [
        { day: "2026-10-21", active: true, sharedActive: true, freeze: false },
        { day: "2026-10-22", active: false, sharedActive: false, freeze: true },
      ],
      start: "2026-10-21",
      today: "2026-10-26",
    });
    // 22 ledgered freeze, 23 active, 24 the second freeze, 25 none left.
    expect(days.map((d) => [d.day, d.freeze, d.settled])).toEqual([
      ["2026-10-21", false, true],
      ["2026-10-22", true, true],
      ["2026-10-23", false, false],
      ["2026-10-24", true, false],
      ["2026-10-25", false, false],
    ]);
  });
});

describe("long streaks", () => {
  it("a 400-day run counts through, with 100 as the milestone", () => {
    const tz = "UTC";
    const launch = "2025-09-01";
    const sessions: StreakSession[] = [];
    let day = launch;
    for (let i = 0; i < 400; i++) {
      const start = Date.parse(`${day}T12:00:00Z`);
      sessions.push({ startedAt: start, endedAt: start + 30 * MIN, pausedMs: 0, pausedSince: null, isPrivate: false });
      day = addDaysISO(day, 1);
    }
    const now = Date.parse(`${addDaysISO(launch, 399)}T18:00:00Z`);
    const s = streakState({
      facts: dayFacts({ sessions, ticks: [], tz, now }),
      ledger: [],
      tz,
      now,
      launch,
    });
    expect(s.state === "live" && [s.current, s.longest, s.milestone]).toEqual([400, 400, 100]);
  });
});

describe("milestoneFor", () => {
  it.each([
    [0, null],
    [6, null],
    [7, 7],
    [29, 7],
    [30, 30],
    [99, 30],
    [100, 100],
    [101, 100],
  ])("%i → %s", (n, m) => {
    expect(milestoneFor(n)).toBe(m);
  });
});
