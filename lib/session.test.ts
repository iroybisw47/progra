import { describe, expect, it } from "vitest";

import { isPaused, sessionPausedMs, sessionWorkedMs } from "@/lib/session";
import type { Session } from "@/lib/storage";

const MIN = 60_000;

function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
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

describe("sessionWorkedMs", () => {
  it("ended session with no pause = wall-clock span", () => {
    const s = makeSession({ startedAt: 0, endedAt: 10 * MIN });
    expect(sessionWorkedMs(s, 999)).toBe(10 * MIN);
  });

  it("ended session subtracts banked pause", () => {
    const s = makeSession({ startedAt: 0, endedAt: 10 * MIN, pausedMs: 3 * MIN });
    expect(sessionWorkedMs(s, 0)).toBe(7 * MIN);
  });

  it("active + running counts up to now", () => {
    const s = makeSession({ startedAt: 0, endedAt: null });
    expect(sessionWorkedMs(s, 5 * MIN)).toBe(5 * MIN);
  });

  it("active + paused freezes worked time at the pause moment", () => {
    // started 0, paused at 4 min
    const s = makeSession({ startedAt: 0, endedAt: null, pausedSince: 4 * MIN });
    expect(sessionWorkedMs(s, 9 * MIN)).toBe(4 * MIN);
    expect(sessionWorkedMs(s, 20 * MIN)).toBe(4 * MIN); // stays frozen
  });

  it("active + paused after an earlier pause subtracts both", () => {
    // 2 min banked, paused again at 10 min → worked = 10 - 2 = 8 min
    const s = makeSession({
      startedAt: 0,
      endedAt: null,
      pausedMs: 2 * MIN,
      pausedSince: 10 * MIN,
    });
    expect(sessionWorkedMs(s, 15 * MIN)).toBe(8 * MIN);
  });

  it("pre-migration row (defaults 0/null) reads back as its original span", () => {
    const s = makeSession({ startedAt: 1000, endedAt: 1000 + 6 * MIN });
    expect(sessionWorkedMs(s, 0)).toBe(6 * MIN);
  });

  it("never goes negative", () => {
    const s = makeSession({ startedAt: 0, endedAt: 1 * MIN, pausedMs: 5 * MIN });
    expect(sessionWorkedMs(s, 0)).toBe(0);
  });
});

describe("sessionPausedMs", () => {
  it("returns banked pause when running", () => {
    expect(sessionPausedMs(makeSession({ pausedMs: 3 * MIN }), 99)).toBe(3 * MIN);
  });

  it("includes the in-progress pause segment", () => {
    const s = makeSession({ pausedMs: 3 * MIN, pausedSince: 10 * MIN });
    expect(sessionPausedMs(s, 12 * MIN)).toBe(5 * MIN);
  });
});

describe("isPaused", () => {
  it("is true only for an active session with pausedSince set", () => {
    expect(isPaused(makeSession({ endedAt: null, pausedSince: 1 }))).toBe(true);
    expect(isPaused(makeSession({ endedAt: null, pausedSince: null }))).toBe(false);
    expect(isPaused(makeSession({ endedAt: 100, pausedSince: 1 }))).toBe(false);
  });
});
