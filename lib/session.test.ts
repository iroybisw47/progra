import { describe, expect, it } from "vitest";

import {
  SESSION_CAP_MS,
  breakFitsTarget,
  breakRemainingMs,
  estimatedWallClockMs,
  isBreakDue,
  plannedBreakCount,
  isOverSessionCap,
  isPaused,
  isPlanComplete,
  msUntilNextBreak,
  nextBreakDueAtWorkedMs,
  plannedEndMs,
  sessionAttributionEnd,
  sessionCapEndMs,
  sessionPausedMs,
  sessionWorkedMs,
} from "@/lib/session";
import type { SessionPlan } from "@/lib/session";
import type { Session } from "@/lib/storage";

const MIN = 60_000;
const HOUR = 3_600_000;

function makeSession(over: Partial<Session> = {}): Session {
  return {
    // Open-ended by default; the timed-session describes override these.
    plannedWorkMs: null,
    workIntervalMs: null,
    breakMs: null,
    onBreak: false,
    breaksTaken: 0,
    planReviewedAt: null,
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

  // Hitting the cap means you forgot to clock out, so the hours aren't real.
  // Zero here is what makes it zero on goals, recaps, rollups and the feed —
  // one rule, every surface.
  it("an auto-ended session is worth zero, not the cap", () => {
    const s = makeSession({
      startedAt: 0,
      endedAt: SESSION_CAP_MS,
      autoEndedAt: SESSION_CAP_MS,
    });
    expect(sessionWorkedMs(s, 99 * HOUR)).toBe(0);
  });

  it("zero regardless of how long the session actually ran", () => {
    for (const endedAt of [1 * HOUR, SESSION_CAP_MS, 40 * HOUR]) {
      const s = makeSession({ startedAt: 0, endedAt, autoEndedAt: endedAt });
      expect(sessionWorkedMs(s, 99 * HOUR)).toBe(0);
    }
  });

  // The escape hatch: re-adding the real hours as a past session produces an
  // ordinary row with no autoEndedAt, which counts normally.
  it("a normal session with the same span still counts in full", () => {
    const s = makeSession({ startedAt: 0, endedAt: SESSION_CAP_MS });
    expect(sessionWorkedMs(s, 99 * HOUR)).toBe(SESSION_CAP_MS);
  });

  // Live surfaces pass a minimal payload with no autoEndedAt at all; an active
  // session can never be auto-ended, so undefined must behave as "not".
  it("an omitted autoEndedAt means not auto-ended", () => {
    const timing = {
      startedAt: 0,
      endedAt: null,
      pausedMs: 0,
      pausedSince: null,
    };
    expect(sessionWorkedMs(timing, 3 * HOUR)).toBe(3 * HOUR);
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

  // The span autoClockOut stamps is still exactly the cap — that's what makes
  // the row honest about when it ended. What it's WORTH is a separate question,
  // answered by the autoEndedAt rule below.
  it("the stamped end is exactly one cap's worth of worked time", () => {
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

// --- Timed sessions -------------------------------------------------------

function makePlan(over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    plannedWorkMs: 2 * HOUR,
    workIntervalMs: 25 * MIN,
    breakMs: 5 * MIN,
    onBreak: false,
    breaksTaken: 0,
    ...over,
  };
}

describe("plannedEndMs", () => {
  // THE invariant the whole feature rests on: end a session at this instant and
  // it reads back as exactly the target. Everything else (breaks, pauses,
  // reconciling after the app was closed) is downstream of this holding.
  it("a session ended here reads back as exactly the target", () => {
    const plan = 2 * HOUR;

    const clean = makeSession({ startedAt: 1000, pausedMs: 0 });
    const end1 = plannedEndMs(clean, plan);
    expect(sessionWorkedMs({ ...clean, endedAt: end1 }, end1)).toBe(plan);

    // With a manual pause banked.
    const paused = makeSession({ startedAt: 1000, pausedMs: 17 * MIN });
    const end2 = plannedEndMs(paused, plan);
    expect(sessionWorkedMs({ ...paused, endedAt: end2 }, end2)).toBe(plan);

    // With four 5-minute breaks banked (breaks are pauses).
    const withBreaks = makeSession({ startedAt: 1000, pausedMs: 4 * 5 * MIN });
    const end3 = plannedEndMs(withBreaks, plan);
    expect(sessionWorkedMs({ ...withBreaks, endedAt: end3 }, end3)).toBe(plan);

    // Breaks and a manual pause mixed.
    const mixed = makeSession({ startedAt: 1000, pausedMs: 4 * 5 * MIN + 9 * MIN });
    const end4 = plannedEndMs(mixed, plan);
    expect(sessionWorkedMs({ ...mixed, endedAt: end4 }, end4)).toBe(plan);
  });

  it("pausing pushes the target instant later by exactly that much", () => {
    const before = plannedEndMs(makeSession({ pausedMs: 0 }), HOUR);
    const after = plannedEndMs(makeSession({ pausedMs: 7 * MIN }), HOUR);
    expect(after - before).toBe(7 * MIN);
  });
});

describe("isPlanComplete", () => {
  it("flips exactly at the target, not before", () => {
    const s = makeSession({ startedAt: 0 });
    const plan = { plannedWorkMs: HOUR };
    expect(isPlanComplete(s, plan, HOUR - 1)).toBe(false);
    expect(isPlanComplete(s, plan, HOUR)).toBe(true);
  });

  it("excludes paused time, so a paused session can't complete on the clock", () => {
    // Started 90m ago but paused for 40m → only 50m worked.
    const s = makeSession({ startedAt: 0, pausedMs: 40 * MIN });
    expect(isPlanComplete(s, { plannedWorkMs: HOUR }, 90 * MIN)).toBe(false);
    expect(isPlanComplete(s, { plannedWorkMs: HOUR }, 100 * MIN)).toBe(true);
  });

  it("is false for open-ended sessions and for ended rows", () => {
    const s = makeSession({ startedAt: 0 });
    expect(isPlanComplete(s, { plannedWorkMs: null }, 99 * HOUR)).toBe(false);
    const ended = makeSession({ startedAt: 0, endedAt: HOUR });
    expect(isPlanComplete(ended, { plannedWorkMs: HOUR }, 99 * HOUR)).toBe(false);
  });
});

describe("nextBreakDueAtWorkedMs", () => {
  it("advances a full interval per break taken", () => {
    expect(nextBreakDueAtWorkedMs(makePlan({ breaksTaken: 0 }))).toBe(25 * MIN);
    expect(nextBreakDueAtWorkedMs(makePlan({ breaksTaken: 1 }))).toBe(50 * MIN);
    expect(nextBreakDueAtWorkedMs(makePlan({ breaksTaken: 3 }))).toBe(100 * MIN);
  });

  it("is null when breaks aren't configured", () => {
    expect(
      nextBreakDueAtWorkedMs(makePlan({ workIntervalMs: null, breakMs: null }))
    ).toBe(null);
  });
});

describe("isBreakDue", () => {
  it("fires once the interval's worth of WORK has been done", () => {
    const s = makeSession({ startedAt: 0 });
    expect(isBreakDue(s, makePlan(), 25 * MIN - 1)).toBe(false);
    expect(isBreakDue(s, makePlan(), 25 * MIN)).toBe(true);
  });

  // The point of counting breaks rather than elapsed time: ending one early
  // must still buy a full interval of work before the next.
  it("gives a full interval after a break ended early", () => {
    // One break taken, and it was cut short — only 1m of it banked.
    const s = makeSession({ startedAt: 0, pausedMs: 1 * MIN });
    const plan = makePlan({ breaksTaken: 1 });
    // 49m worked → not yet.
    expect(isBreakDue(s, plan, 49 * MIN + 1 * MIN)).toBe(false);
    // 50m worked → due.
    expect(isBreakDue(s, plan, 50 * MIN + 1 * MIN)).toBe(true);
  });

  it("never interrupts the run-in to the finish line", () => {
    // Target 25m and the interval also 25m: the break and the end coincide,
    // and finishing must win.
    const s = makeSession({ startedAt: 0 });
    const plan = makePlan({ plannedWorkMs: 25 * MIN });
    expect(isBreakDue(s, plan, 25 * MIN)).toBe(false);
  });

  it("is false while already on a break, and when breaks are off", () => {
    const s = makeSession({ startedAt: 0, pausedSince: 25 * MIN });
    expect(isBreakDue(s, makePlan({ onBreak: true }), 30 * MIN)).toBe(false);
    expect(
      isBreakDue(s, makePlan({ workIntervalMs: null, breakMs: null }), 99 * HOUR)
    ).toBe(false);
  });
});

describe("msUntilNextBreak", () => {
  it("counts down the worked time to the next boundary", () => {
    const s = makeSession({ startedAt: 0 });
    expect(msUntilNextBreak(s, makePlan(), 0)).toBe(25 * MIN);
    expect(msUntilNextBreak(s, makePlan(), 10 * MIN)).toBe(15 * MIN);
  });

  it("ignores paused time, matching worked-time semantics", () => {
    // 40m elapsed but 15m of it paused → 25m worked, so the boundary is here.
    const s = makeSession({ startedAt: 0, pausedMs: 15 * MIN });
    expect(msUntilNextBreak(s, makePlan(), 40 * MIN)).toBe(0);
  });

  // The case this function exists for: with a 1h target at 25/5 the breaks are
  // at 25m and 50m and then there are no more, so the timer must stop
  // promising one that isBreakDue would refuse to fire.
  it("returns null once no further break can fire", () => {
    const s = makeSession({ startedAt: 0 });
    const plan = makePlan({ plannedWorkMs: HOUR, breaksTaken: 2 });
    // Next boundary would be 75m, past the 60m target.
    expect(msUntilNextBreak(s, plan, 50 * MIN)).toBe(null);
  });

  it("is null while on a break, and when breaks aren't configured", () => {
    const s = makeSession({ startedAt: 0, pausedSince: 25 * MIN });
    expect(msUntilNextBreak(s, makePlan({ onBreak: true }), 26 * MIN)).toBe(null);
    expect(
      msUntilNextBreak(
        makeSession({ startedAt: 0 }),
        makePlan({ workIntervalMs: null, breakMs: null }),
        10 * MIN
      )
    ).toBe(null);
  });
});

describe("breakRemainingMs", () => {
  it("counts down from the break length", () => {
    const s = makeSession({ startedAt: 0, pausedSince: 25 * MIN });
    const plan = makePlan({ onBreak: true });
    expect(breakRemainingMs(s, plan, 25 * MIN)).toBe(5 * MIN);
    expect(breakRemainingMs(s, plan, 27 * MIN)).toBe(3 * MIN);
  });

  it("floors at zero instead of going negative", () => {
    const s = makeSession({ startedAt: 0, pausedSince: 25 * MIN });
    const plan = makePlan({ onBreak: true });
    expect(breakRemainingMs(s, plan, 40 * MIN)).toBe(0);
  });

  it("is zero when not on a break", () => {
    const s = makeSession({ startedAt: 0, pausedSince: null });
    expect(breakRemainingMs(s, makePlan(), 30 * MIN)).toBe(0);
  });
});

describe("breakFitsTarget", () => {
  // One rule, two consumers: the picker greys presets out with it and
  // resolvePlan rejects with it. If they ever disagreed, the UI would offer a
  // combination the server refuses.
  it("requires the interval to fall strictly inside the target", () => {
    expect(breakFitsTarget(25 * MIN, HOUR)).toBe(true);
    expect(breakFitsTarget(50 * MIN, HOUR)).toBe(true);
    // The boundary case: an interval equal to the target puts the only break
    // exactly on the finish line, where isBreakDue refuses to fire it.
    expect(breakFitsTarget(50 * MIN, 50 * MIN)).toBe(false);
    expect(breakFitsTarget(50 * MIN, 30 * MIN)).toBe(false);
  });

  it("agrees with plannedBreakCount — a fitting schedule serves >= 1 break", () => {
    for (const [interval, target] of [
      [25 * MIN, HOUR],
      [50 * MIN, HOUR],
      [25 * MIN, 47 * MIN],
      [50 * MIN, 50 * MIN],
      [50 * MIN, 30 * MIN],
    ] as const) {
      const fits = breakFitsTarget(interval, target);
      expect(plannedBreakCount(target, interval) > 0).toBe(fits);
    }
  });
});

describe("plannedBreakCount / estimatedWallClockMs", () => {
  // The boundary that coincides with the finish line must NOT count — this is
  // the same rule isBreakDue enforces, and the clock-in preview lies to the
  // user if the two ever disagree.
  it("never counts a break that falls on the finish line", () => {
    expect(plannedBreakCount(50 * MIN, 25 * MIN)).toBe(1); // 25 only, not 50
    expect(plannedBreakCount(75 * MIN, 25 * MIN)).toBe(2); // 25, 50
  });

  it("counts every boundary strictly before the target", () => {
    expect(plannedBreakCount(2 * HOUR, 25 * MIN)).toBe(4); // 25/50/75/100
    expect(plannedBreakCount(HOUR, 50 * MIN)).toBe(1); // 50 only
  });

  it("is zero when the target is shorter than one interval", () => {
    expect(plannedBreakCount(20 * MIN, 25 * MIN)).toBe(0);
  });

  it("is zero when breaks aren't configured", () => {
    expect(plannedBreakCount(2 * HOUR, null)).toBe(0);
  });

  it("adds every served break to the wall clock", () => {
    // 2h of work + 4 breaks x 5m = 2h20m.
    expect(estimatedWallClockMs(2 * HOUR, 25 * MIN, 5 * MIN)).toBe(140 * MIN);
    // No breaks configured → wall clock is just the target.
    expect(estimatedWallClockMs(2 * HOUR, null, null)).toBe(2 * HOUR);
  });

  // The preview and the runtime must agree: the count the preview shows is the
  // number of times isBreakDue will actually fire.
  it("agrees with isBreakDue over a whole simulated session", () => {
    const planned = 2 * HOUR;
    const interval = 25 * MIN;
    let breaksTaken = 0;
    // Walk worked time in 1-minute steps, taking a break whenever one is due.
    for (let worked = 0; worked <= planned; worked += MIN) {
      const s = makeSession({ startedAt: 0, pausedMs: 0 });
      const plan = makePlan({
        plannedWorkMs: planned,
        workIntervalMs: interval,
        breakMs: 5 * MIN,
        breaksTaken,
      });
      if (isBreakDue(s, plan, worked)) breaksTaken += 1;
    }
    expect(breaksTaken).toBe(plannedBreakCount(planned, interval));
  });
});

describe("open-ended sessions are untouched", () => {
  // Every session that existed before this feature, and every one started with
  // the flag off. If this ever fails, the feature has leaked into the old path.
  it("all plan helpers no-op and worked time is unchanged", () => {
    const s = makeSession({ startedAt: 0, endedAt: 90 * MIN, pausedMs: 10 * MIN });
    const none = makePlan({
      plannedWorkMs: null,
      workIntervalMs: null,
      breakMs: null,
    });
    expect(sessionWorkedMs(s, 99 * HOUR)).toBe(80 * MIN);
    expect(isPlanComplete(s, none, 99 * HOUR)).toBe(false);
    expect(nextBreakDueAtWorkedMs(none)).toBe(null);
    expect(isBreakDue(s, none, 99 * HOUR)).toBe(false);
    expect(breakRemainingMs(s, none, 99 * HOUR)).toBe(0);
  });
});
