import { describe, expect, it } from "vitest";

import fixtures from "@/lib/group-leaderboard.fixtures.json";
import { aggregateRangeByGoal } from "@/lib/aggregate";
import type { Session } from "@/lib/storage";

// The group leaderboard's totals come from SQL (groups.sql group_week_totals);
// these are the same cases the PGlite harness runs through it
// (.claude/plans/nudges-harness/groups.mjs), run here through the TypeScript
// the rest of the app ranks with: the circle read's filter
// (lib/db/friends-leaderboard.ts — started before the end, and ended after the
// start or still running), then aggregateRangeByGoal with `now` capped at the
// week's end. If either side moves, one of the two suites fails.

const MIN = 60_000;
const ms = (iso: string) => Date.parse(iso);

type FixtureSession = {
  start: string;
  end: string | null;
  pausedMin?: number;
  pausedSince?: string;
  autoEnded?: boolean;
  private?: boolean;
  goal?: boolean;
};

function toSession(s: FixtureSession, i: number): Session {
  const endedAt = s.end === null ? null : ms(s.end);
  return {
    id: `s${i}`,
    categoryId: null,
    goalId: s.goal ? "g1" : null,
    taskName: "fx",
    startedAt: ms(s.start),
    endedAt,
    pausedMs: (s.pausedMin ?? 0) * MIN,
    pausedSince: s.pausedSince ? ms(s.pausedSince) : null,
    isPrivate: s.private ?? false,
    photoPath: null,
    autoEndedAt: s.autoEnded ? endedAt : null,
    autoEndReviewedAt: null,
    plannedWorkMs: null,
    workIntervalMs: null,
    breakMs: null,
    onBreak: false,
    breaksTaken: 0,
    planReviewedAt: null,
  };
}

// The read filter, as getCircleRowsInWindow's query states it.
const read = (s: Session, start: number, end: number) =>
  s.startedAt < end && (s.endedAt === null || s.endedAt > start);

describe("group leaderboard parity fixtures", () => {
  const start = ms(fixtures.window.start);
  const end = ms(fixtures.window.end);

  for (const c of fixtures.cases) {
    it(c.name, () => {
      const sessions = (c.sessions as FixtureSession[])
        .map(toSession)
        .filter((s) => read(s, start, end));
      const now = Math.min(ms(c.now), end);
      expect(aggregateRangeByGoal(sessions, start, end, now).total).toBe(c.expectMs);
    });
  }
});
