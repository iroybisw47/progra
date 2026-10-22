import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_PLACEHOLDER,
  announcementFor,
  freezesLine,
  friendBadge,
  launchLabel,
  myBadge,
  rowToFriendStreak,
  rowToMyStreak,
  type MyStreak,
} from "@/lib/streaks-view";

const LIVE_ROW = {
  state: "live",
  launch: "2026-10-21",
  today: "2026-10-24",
  current: 3,
  longest: 3,
  at_risk: false,
  today_active: true,
  freezes_left: 1,
  freeze_days: ["2026-10-23"],
  shared_current: 3,
  shared_longest: 3,
  unsettled: 0,
  milestone: null,
};

const live = (over: Partial<Extract<MyStreak, { state: "live" }>> = {}): MyStreak => ({
  ...(rowToMyStreak(LIVE_ROW) as Extract<MyStreak, { state: "live" }>),
  ...over,
});

describe("rowToMyStreak", () => {
  it("maps the RPC's snake_case", () => {
    expect(rowToMyStreak(LIVE_ROW)).toEqual({
      state: "live",
      launch: "2026-10-21",
      today: "2026-10-24",
      current: 3,
      longest: 3,
      atRisk: false,
      todayActive: true,
      freezesLeft: 1,
      freezeDays: ["2026-10-23"],
      milestone: null,
      unsettled: 0,
    });
  });
  it("pre-launch carries only the date", () => {
    expect(rowToMyStreak({ state: "prelaunch", launch: null })).toEqual({ state: "prelaunch", launch: null });
    expect(rowToMyStreak({ state: "prelaunch", launch: "2026-10-21", current: 9 })).toEqual({
      state: "prelaunch",
      launch: "2026-10-21",
    });
  });
  it("is null for null (switched off) and for junk", () => {
    expect(rowToMyStreak(null)).toBeNull();
    expect(rowToMyStreak("live")).toBeNull();
    expect(rowToMyStreak({ state: "live" })).toBeNull();
    expect(rowToMyStreak({ ...LIVE_ROW, today: "soon" })).toBeNull();
  });
  it("never trusts a bad number", () => {
    const s = rowToMyStreak({ ...LIVE_ROW, current: -4, freezes_left: 9, milestone: 12 });
    expect(s?.state === "live" && [s.current, s.freezesLeft, s.milestone]).toEqual([0, 2, null]);
  });
});

describe("rowToFriendStreak", () => {
  it("keeps only the shared numbers it was given", () => {
    expect(rowToFriendStreak({ state: "live", launch: "2026-10-21", current: 5, longest: 8 })).toEqual({
      state: "live",
      launch: "2026-10-21",
      current: 5,
      longest: 8,
    });
  });
  it("is null when the RPC says nothing (not friends, blocked, off)", () => {
    expect(rowToFriendStreak(null)).toBeNull();
  });
});

describe("myBadge", () => {
  it("is hidden at 0 and before launch", () => {
    expect(myBadge(live({ current: 0 }))).toBeNull();
    expect(myBadge({ state: "prelaunch", launch: "2026-10-21" })).toBeNull();
    expect(myBadge(null)).toBeNull();
  });
  it("shows from 1, dimmed while at risk", () => {
    expect(myBadge(live({ current: 1, atRisk: true }))).toEqual({ count: 1, dim: true, milestone: null });
    expect(myBadge(live({ current: 30, milestone: 30 }))).toEqual({ count: 30, dim: false, milestone: 30 });
  });
});

describe("friendBadge", () => {
  it("shows from 1", () => {
    expect(friendBadge({ state: "live", launch: "2026-10-21", current: 0, longest: 9 })).toBeNull();
    expect(friendBadge({ state: "live", launch: "2026-10-21", current: 1, longest: 9 })).toEqual({
      count: 1,
      dim: false,
      milestone: null,
    });
  });
  it("milestones from the shared count", () => {
    expect(friendBadge({ state: "live", launch: "2026-10-21", current: 104, longest: 104 })?.milestone).toBe(100);
  });
  it("never before launch", () => {
    expect(friendBadge({ state: "prelaunch", launch: "2026-10-21" })).toBeNull();
  });
});

describe("copy helpers", () => {
  it("freezesLine names the month of today", () => {
    expect(freezesLine(2, "2026-10-21")).toBe("2 of 2 freezes left in October");
    expect(freezesLine(0, "2026-11-30")).toBe("0 of 2 freezes left in November");
  });
  it("launchLabel reads the date as a calendar date", () => {
    expect(launchLabel("2026-10-21")).toBe("Wednesday, October 21");
    expect(launchLabel("2027-01-01")).toBe("Friday, January 1");
  });
});

describe("announcementFor", () => {
  const COPY = "Streaks are here";
  const pre: MyStreak = { state: "prelaunch", launch: "2026-10-21" };
  it("pre-launch: shown with the date until dismissed", () => {
    expect(announcementFor({ streak: pre, seenDay: null, copy: COPY, production: true })).toEqual({
      phase: "prelaunch",
      when: "Wednesday, October 21",
    });
    expect(announcementFor({ streak: pre, seenDay: "2026-10-19", copy: COPY, production: true })).toBeNull();
  });
  it("pre-launch with no date yet says nothing about when", () => {
    expect(
      announcementFor({ streak: { state: "prelaunch", launch: null }, seenDay: null, copy: COPY, production: true })
    ).toEqual({ phase: "prelaunch", when: null });
  });
  it("after launch: once more, even for a pre-launch dismissal", () => {
    expect(announcementFor({ streak: live(), seenDay: "2026-10-19", copy: COPY, production: true })).toEqual({
      phase: "launched",
    });
    expect(announcementFor({ streak: live(), seenDay: null, copy: COPY, production: true })).toEqual({
      phase: "launched",
    });
  });
  it("after launch: gone once dismissed on or after Day One", () => {
    expect(announcementFor({ streak: live(), seenDay: "2026-10-21", copy: COPY, production: true })).toBeNull();
  });
  it("a first open after Day One still gets it once", () => {
    expect(
      announcementFor({ streak: live({ current: 0, longest: 0 }), seenDay: null, copy: COPY, production: true })
    ).toEqual({ phase: "launched" });
  });
  it("placeholder copy never renders in production, only in dev", () => {
    expect(
      announcementFor({ streak: pre, seenDay: null, copy: ANNOUNCEMENT_PLACEHOLDER, production: true })
    ).toBeNull();
    expect(
      announcementFor({ streak: pre, seenDay: null, copy: ANNOUNCEMENT_PLACEHOLDER, production: false })
    ).not.toBeNull();
  });
  it("switched off: nothing", () => {
    expect(announcementFor({ streak: null, seenDay: null, copy: COPY, production: true })).toBeNull();
  });
});
