import { describe, expect, it } from "vitest";

import { SESSION_CAP_MS } from "@/lib/session";
import {
  DAY_MS,
  WEEK_MS,
  clippedWorkedMs,
  friendBucket,
  friendsInFirstWeek,
  isActivated,
  isGhost,
  loggedDaysInFirstWeek,
  userState,
  workedMs,
} from "@/lib/telemetry/metrics";

const NOW = Date.UTC(2026, 9, 7, 12, 0, 0); // 2026-10-07T12:00Z
const H = 60 * 60 * 1000;

describe("userState — exclusive and exhaustive", () => {
  const onboarded = NOW - 30 * DAY_MS;

  it("not onboarded wins regardless of logs", () => {
    expect(userState({ onboardedAt: null, lastLoggedAt: NOW - H, now: NOW })).toBe("not_onboarded");
  });

  it("onboarded with no log ever is never_logged", () => {
    expect(userState({ onboardedAt: onboarded, lastLoggedAt: null, now: NOW })).toBe("never_logged");
  });

  it("a log inside 7 days is active; at exactly 7 days it is lapsed (rolling, half-open)", () => {
    expect(userState({ onboardedAt: onboarded, lastLoggedAt: NOW - WEEK_MS + 1, now: NOW })).toBe("active");
    expect(userState({ onboardedAt: onboarded, lastLoggedAt: NOW - WEEK_MS, now: NOW })).toBe("lapsed");
    expect(userState({ onboardedAt: onboarded, lastLoggedAt: NOW - 60 * DAY_MS, now: NOW })).toBe("lapsed");
  });

  it("every user lands in exactly one state", () => {
    const cases = [
      { onboardedAt: null, lastLoggedAt: null },
      { onboardedAt: onboarded, lastLoggedAt: null },
      { onboardedAt: onboarded, lastLoggedAt: NOW - H },
      { onboardedAt: onboarded, lastLoggedAt: NOW - 10 * DAY_MS },
    ];
    const states = cases.map((c) => userState({ ...c, now: NOW }));
    expect(new Set(states).size).toBe(4);
  });
});

describe("isGhost — the overlay", () => {
  const onboarded = NOW - 30 * DAY_MS;

  it("opened this week, logged nothing this week", () => {
    expect(isGhost({ onboardedAt: onboarded, lastOpenedAt: NOW - H, lastLoggedAt: null, now: NOW })).toBe(true);
    expect(isGhost({ onboardedAt: onboarded, lastOpenedAt: NOW - H, lastLoggedAt: NOW - 8 * DAY_MS, now: NOW })).toBe(true);
  });

  it("is not a ghost when active, never opened, opened too long ago, or not onboarded", () => {
    expect(isGhost({ onboardedAt: onboarded, lastOpenedAt: NOW - H, lastLoggedAt: NOW - 2 * H, now: NOW })).toBe(false);
    expect(isGhost({ onboardedAt: onboarded, lastOpenedAt: null, lastLoggedAt: null, now: NOW })).toBe(false);
    expect(isGhost({ onboardedAt: onboarded, lastOpenedAt: NOW - 8 * DAY_MS, lastLoggedAt: null, now: NOW })).toBe(false);
    expect(isGhost({ onboardedAt: null, lastOpenedAt: NOW - H, lastLoggedAt: null, now: NOW })).toBe(false);
  });

  it("a ghost is always a never_logged or lapsed user", () => {
    const ghost = { onboardedAt: onboarded, lastOpenedAt: NOW - H, lastLoggedAt: NOW - 9 * DAY_MS, now: NOW };
    expect(isGhost(ghost)).toBe(true);
    expect(["never_logged", "lapsed"]).toContain(userState(ghost));
  });
});

describe("activation — both halves, both inside the first 7 days", () => {
  const signup = NOW - 20 * DAY_MS;

  it("counts friends accepted from signup up to (not including) day 7", () => {
    expect(
      friendsInFirstWeek(signup, [signup, signup + 6 * DAY_MS, signup + WEEK_MS - 1])
    ).toBe(3);
    expect(friendsInFirstWeek(signup, [signup + WEEK_MS, signup - 1])).toBe(0);
  });

  it("counts DISTINCT logged local days in the 7 days starting on the signup day", () => {
    expect(
      loggedDaysInFirstWeek("2026-09-17", ["2026-09-17", "2026-09-17", "2026-09-19", "2026-09-23"])
    ).toBe(3);
    // Day 7 (the 24th) is outside; the day before signup is outside.
    expect(loggedDaysInFirstWeek("2026-09-17", ["2026-09-16", "2026-09-24"])).toBe(0);
  });

  it("needs 3 friends AND 3 days", () => {
    expect(isActivated({ friendsInFirstWeek: 3, loggedDaysInFirstWeek: 3 })).toBe(true);
    expect(isActivated({ friendsInFirstWeek: 2, loggedDaysInFirstWeek: 5 })).toBe(false);
    expect(isActivated({ friendsInFirstWeek: 5, loggedDaysInFirstWeek: 2 })).toBe(false);
  });
});

describe("workedMs — sessionWorkedMs restated", () => {
  const base = { pausedMs: 0, pausedSince: null, autoEndedAt: null };

  it("an auto-ended session is worth zero", () => {
    expect(workedMs({ ...base, startedAt: NOW - 11 * H, endedAt: NOW - H, autoEndedAt: NOW - H }, NOW)).toBe(0);
  });

  it("subtracts banked and in-progress pauses", () => {
    expect(workedMs({ ...base, startedAt: NOW - 2 * H, endedAt: NOW, pausedMs: 30 * 60_000 }, NOW)).toBe(90 * 60_000);
    expect(
      workedMs({ ...base, startedAt: NOW - 2 * H, endedAt: null, pausedMs: 0, pausedSince: NOW - 15 * 60_000 }, NOW)
    ).toBe(105 * 60_000);
  });

  it("caps a RUNNING session at 10h but reads an ended one back as stored", () => {
    expect(workedMs({ ...base, startedAt: NOW - 12 * H, endedAt: null }, NOW)).toBe(SESSION_CAP_MS);
    expect(workedMs({ ...base, startedAt: NOW - 12 * H, endedAt: NOW }, NOW)).toBe(12 * H);
  });
});

describe("clippedWorkedMs — the rolling-window rule", () => {
  const base = { pausedMs: 0, pausedSince: null, autoEndedAt: null };
  const winStart = NOW - WEEK_MS;

  it("a session wholly inside the window is unchanged", () => {
    expect(clippedWorkedMs({ ...base, startedAt: NOW - 3 * H, endedAt: NOW - H }, winStart, NOW, NOW)).toBe(2 * H);
  });

  it("a session wholly outside is zero", () => {
    expect(clippedWorkedMs({ ...base, startedAt: winStart - 3 * H, endedAt: winStart - H }, winStart, NOW, NOW)).toBe(0);
  });

  it("a session straddling the window start keeps only the share inside", () => {
    // 4h session, started 1h before the window: 3/4 of it counts.
    expect(clippedWorkedMs({ ...base, startedAt: winStart - H, endedAt: winStart + 3 * H }, winStart, NOW, NOW)).toBe(3 * H);
  });

  it("pauses clip proportionally with the span", () => {
    // 4h span with 1h paused = 3h worked; half the span inside → 1.5h.
    expect(
      clippedWorkedMs({ ...base, startedAt: winStart - 2 * H, endedAt: winStart + 2 * H, pausedMs: H }, winStart, NOW, NOW)
    ).toBe(1.5 * H);
  });

  it("an auto-ended session contributes nothing however it overlaps", () => {
    expect(
      clippedWorkedMs({ ...base, startedAt: NOW - 3 * H, endedAt: NOW, autoEndedAt: NOW }, winStart, NOW, NOW)
    ).toBe(0);
  });

  it("a running session is clipped against now", () => {
    expect(clippedWorkedMs({ ...base, startedAt: NOW - H, endedAt: null }, winStart, NOW, NOW)).toBe(H);
  });
});

describe("friendBucket", () => {
  it("has the six spec buckets with inclusive edges", () => {
    expect([0, 1, 2, 3, 4, 5, 9, 10, 40].map(friendBucket)).toEqual([
      "0", "1", "2", "3-4", "3-4", "5-9", "5-9", "10+", "10+",
    ]);
  });
});
