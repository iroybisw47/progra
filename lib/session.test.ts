import { describe, expect, it } from "vitest";

import {
  SESSION_CAP_MS,
  isOverSessionCap,
  isPaused,
  sessionAttributionEnd,
  sessionCapEndMs,
  sessionPausedMs,
  sessionWorkedMs,
} from "@/lib/session";
import type { Session } from "@/lib/storage";

const MIN = 60_000;
const HOUR = 3_600_000;

function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    categoryId: "c1",
    goalId: null,
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

  it("never exceeds the cap while active", () => {
    const s = makeSession({ startedAt: 0, endedAt: null });
    expect(sessionWorkedMs(s, 30 * HOUR)).toBe(SESSION_CAP_MS);
  });

  it("the cap counts WORKED time, so pauses push it later", () => {
    // 14h wall clock, 5h banked as pause → 9h worked, still under the cap.
    const s = makeSession({ startedAt: 0, endedAt: null, pausedMs: 5 * HOUR });
    expect(sessionWorkedMs(s, 14 * HOUR)).toBe(9 * HOUR);
  });

  it("a session paused under the cap never trips it, however long it sits", () => {
    const s = makeSession({ startedAt: 0, endedAt: null, pausedSince: 4 * HOUR });
    expect(sessionWorkedMs(s, 40 * HOUR)).toBe(4 * HOUR);
  });

  it("an ended session is never clamped — history reads back as stored", () => {
    const s = makeSession({ startedAt: 0, endedAt: 30 * HOUR });
    expect(sessionWorkedMs(s, 99 * HOUR)).toBe(30 * HOUR);
  });
});

describe("sessionCapEndMs", () => {
  it("is start + cap when nothing was paused", () => {
    expect(sessionCapEndMs(makeSession({ startedAt: 0 }))).toBe(SESSION_CAP_MS);
  });

  it("banked pause pushes the cap end later by the paused amount", () => {
    const s = makeSession({ startedAt: 0, pausedMs: 2 * HOUR });
    expect(sessionCapEndMs(s)).toBe(SESSION_CAP_MS + 2 * HOUR);
  });

  // THE invariant autoClockOut relies on: the row it writes reads back at
  // exactly the cap, so no ended-row clamp (and no backfill) is ever needed.
  it("an auto-ended row reads back at exactly the cap", () => {
    for (const pausedMs of [0, 90 * MIN, 6 * HOUR]) {
      const s = makeSession({ startedAt: 1_700_000_000_000, pausedMs });
      const ended = { ...s, endedAt: sessionCapEndMs(s) };
      expect(sessionWorkedMs(ended, 0)).toBe(SESSION_CAP_MS);
      expect(sessionWorkedMs(ended, 99 * HOUR)).toBe(SESSION_CAP_MS);
    }
  });

  // Proves autoClockOut never stamps a future ended_at.
  it("the cap end is never after now once the cap is reached", () => {
    const s = makeSession({ startedAt: 0, endedAt: null, pausedMs: 3 * HOUR });
    const now = 13 * HOUR; // worked = 10h, exactly at the cap
    expect(isOverSessionCap(s, now)).toBe(true);
    expect(sessionCapEndMs(s)).toBeLessThanOrEqual(now);
  });
});

describe("isOverSessionCap", () => {
  it("is false for an ended session however long — historical runaways stand", () => {
    const s = makeSession({ startedAt: 0, endedAt: 30 * HOUR });
    expect(isOverSessionCap(s, 99 * HOUR)).toBe(false);
  });

  it("is false while paused under the cap", () => {
    const s = makeSession({ startedAt: 0, endedAt: null, pausedSince: 4 * HOUR });
    expect(isOverSessionCap(s, 40 * HOUR)).toBe(false);
  });

  it("is true for a running session past the cap", () => {
    const s = makeSession({ startedAt: 0, endedAt: null });
    expect(isOverSessionCap(s, 11 * HOUR)).toBe(true);
  });

  it("is true when paused AFTER crossing the cap (the offline case)", () => {
    // Crossed at 10h, paused at 12h, app reopened a day later.
    const s = makeSession({ startedAt: 0, endedAt: null, pausedSince: 12 * HOUR });
    expect(isOverSessionCap(s, 36 * HOUR)).toBe(true);
    expect(sessionCapEndMs(s)).toBeLessThanOrEqual(12 * HOUR);
  });
});

describe("sessionAttributionEnd", () => {
  it("is endedAt for an ended session", () => {
    const s = makeSession({ startedAt: 0, endedAt: 5 * HOUR });
    expect(sessionAttributionEnd(s, 9 * HOUR)).toBe(5 * HOUR);
  });

  it("is now for an active session under the cap", () => {
    const s = makeSession({ startedAt: 0, endedAt: null });
    expect(sessionAttributionEnd(s, 3 * HOUR)).toBe(3 * HOUR);
  });

  it("is still now for a long-paused session under the cap", () => {
    const s = makeSession({ startedAt: 0, endedAt: null, pausedSince: 2 * HOUR });
    expect(sessionAttributionEnd(s, 40 * HOUR)).toBe(40 * HOUR);
  });

  // The day/week bucket must not move when autoClockOut's write lands.
  it("is the cap end once over the cap, matching where auto-clock-out puts it", () => {
    const s = makeSession({ startedAt: 0, endedAt: null });
    expect(sessionAttributionEnd(s, 50 * HOUR)).toBe(SESSION_CAP_MS);
    const afterWrite = { ...s, endedAt: sessionCapEndMs(s) };
    expect(sessionAttributionEnd(afterWrite, 50 * HOUR)).toBe(SESSION_CAP_MS);
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
