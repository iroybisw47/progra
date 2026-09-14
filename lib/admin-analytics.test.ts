import { describe, expect, it } from "vitest";

import {
  cohortTable,
  daysBetweenISO,
  dauSeries,
  formatDaysAgo,
  groupDaysByUser,
  isOpeningNotDoing,
  neverCameBack,
  rollingActive,
  sortUsers,
  sparklineDays,
  type ActivityDay,
  type AnalyticsUser,
} from "@/lib/admin-analytics";

const TODAY = "2026-09-14"; // a Monday

let idc = 0;
function user(over: Partial<AnalyticsUser> = {}): AnalyticsUser {
  return {
    id: `u${idc++}`,
    email: null,
    signedUpAt: "2026-08-01T12:00:00+00:00",
    username: null,
    displayName: null,
    seatNo: 1,
    onboardedOn: "2026-08-01",
    localToday: TODAY,
    lastSeenAt: null,
    lastActiveOn: null,
    excluded: false,
    goals: [],
    ...over,
  };
}

function day(userId: string, d: string, over: Partial<ActivityDay> = {}): ActivityDay {
  return { userId, day: d, trackedMin: 30, habitTicks: 0, ...over };
}

describe("date helpers", () => {
  it("counts whole days across a month boundary", () => {
    expect(daysBetweenISO("2026-08-30", "2026-09-02")).toBe(3);
  });

  it("formats day-grained recency", () => {
    expect(formatDaysAgo(0)).toBe("Today");
    expect(formatDaysAgo(1)).toBe("Yesterday");
    expect(formatDaysAgo(5)).toBe("5d ago");
    expect(formatDaysAgo(21)).toBe("3w ago");
  });
});

describe("rollingActive", () => {
  it("keeps excluded, waitlisted, and never-onboarded users out of both sides", () => {
    const users = [
      user({ lastActiveOn: TODAY }),
      user({ lastActiveOn: TODAY, excluded: true }),
      user({ lastActiveOn: TODAY, seatNo: null }),
      user({ lastActiveOn: TODAY, onboardedOn: null }),
    ];
    expect(rollingActive(users, 7)).toEqual({ n: 1, m: 1 });
  });

  it("includes the first day of the window and excludes the day before", () => {
    const users = [
      user({ lastActiveOn: "2026-09-08" }), // 6 days ago — inside a 7-day window
      user({ lastActiveOn: "2026-09-07" }), // 7 days ago — outside
    ];
    expect(rollingActive(users, 7)).toEqual({ n: 1, m: 2 });
  });

  it("judges each user against their own local today", () => {
    // Already tomorrow for this user, so yesterday-UTC activity is 2 days old.
    const u = user({ localToday: "2026-09-15", lastActiveOn: "2026-09-08" });
    expect(rollingActive([u], 7)).toEqual({ n: 0, m: 1 });
  });
});

describe("neverCameBack", () => {
  it("counts a user whose only activity was onboarding day", () => {
    const u = user({ onboardedOn: "2026-09-01", lastActiveOn: "2026-09-01" });
    expect(neverCameBack([u])).toEqual({ n: 1, m: 1 });
  });

  it("counts a user who never did anything at all", () => {
    expect(neverCameBack([user({ onboardedOn: "2026-09-01" })])).toEqual({ n: 1, m: 1 });
  });

  it("does not count someone who came back", () => {
    const u = user({ onboardedOn: "2026-09-01", lastActiveOn: "2026-09-03" });
    expect(neverCameBack([u])).toEqual({ n: 0, m: 1 });
  });

  it("isn't eligible until the whole day after onboarding has passed", () => {
    const users = [
      user({ onboardedOn: TODAY }),
      user({ onboardedOn: "2026-09-13" }), // yesterday — today isn't over yet
      user({ onboardedOn: "2026-09-12" }), // day after (the 13th) has elapsed
    ];
    expect(neverCameBack(users)).toEqual({ n: 1, m: 1 });
  });
});

describe("dauSeries", () => {
  it("counts distinct counted users per day, zero-filled, oldest first", () => {
    const a = user();
    const b = user();
    const demo = user({ excluded: true });
    const byUser = groupDaysByUser([
      day(a.id, "2026-09-13"),
      day(b.id, "2026-09-13", { trackedMin: 0, habitTicks: 2 }), // habit-only still counts
      day(a.id, "2026-09-14"),
      day(demo.id, "2026-09-14"),
    ]);
    expect(dauSeries([a, b, demo], byUser, TODAY, 3)).toEqual([
      { day: "2026-09-12", count: 0 },
      { day: "2026-09-13", count: 2 },
      { day: "2026-09-14", count: 1 },
    ]);
  });
});

describe("cohortTable", () => {
  const SINCE = "2026-06-01";

  it("groups by the Monday of the onboarding week", () => {
    const users = [
      user({ onboardedOn: "2026-08-19" }), // Wed
      user({ onboardedOn: "2026-08-23" }), // Sun, same week
      user({ onboardedOn: "2026-08-24" }), // next Mon
    ];
    const rows = cohortTable(users, new Map(), SINCE, 1);
    expect(rows.map((r) => [r.weekOf, r.size])).toEqual([
      ["2026-08-17", 2],
      ["2026-08-24", 1],
    ]);
  });

  it("leaves a window blank until it has fully elapsed — never 0%", () => {
    // Onboarded 10 days ago: W0 (days 0–6) is over, W1 (days 7–13) is not.
    const u = user({ onboardedOn: "2026-09-04" });
    const [row] = cohortTable([u], new Map(), SINCE, 3);
    expect(row.cells).toEqual([{ n: 0, m: 1 }, null, null]);
  });

  it("treats a window ending today as not yet elapsed", () => {
    // W0 = Sep 8–14, and today is the 14th.
    const u = user({ onboardedOn: "2026-09-08" });
    const [row] = cohortTable([u], new Map(), SINCE, 1);
    expect(row.cells).toEqual([null]);
  });

  it("marks a week active on any activity inside its window, habits included", () => {
    const u = user({ onboardedOn: "2026-08-03" });
    const byUser = groupDaysByUser([
      day(u.id, "2026-08-03"), // W0, onboarding day
      day(u.id, "2026-08-16", { trackedMin: 0, habitTicks: 1 }), // W1's last day
    ]);
    const [row] = cohortTable([u], byUser, SINCE, 3);
    expect(row.cells).toEqual([
      { n: 1, m: 1 },
      { n: 1, m: 1 },
      { n: 0, m: 1 },
    ]);
  });

  it("drops cohorts older than the activity window instead of showing them empty", () => {
    const users = [user({ onboardedOn: "2026-05-20" }), user({ onboardedOn: "2026-08-03" })];
    expect(cohortTable(users, new Map(), SINCE, 1).map((r) => r.weekOf)).toEqual([
      "2026-08-03",
    ]);
  });

  it("leaves excluded and waitlisted users out of every cohort", () => {
    const users = [
      user({ onboardedOn: "2026-08-03", excluded: true }),
      user({ onboardedOn: "2026-08-03", seatNo: null }),
    ];
    expect(cohortTable(users, new Map(), SINCE, 1)).toEqual([]);
  });
});

describe("sparklineDays", () => {
  it("is dense and zero-filled across gaps", () => {
    const u = user();
    const byUser = groupDaysByUser([day(u.id, "2026-09-12", { trackedMin: 45 })]);
    expect(sparklineDays(byUser.get(u.id), TODAY, 3)).toEqual([
      { day: "2026-09-12", trackedMin: 45, habitTicks: 0 },
      { day: "2026-09-13", trackedMin: 0, habitTicks: 0 },
      { day: "2026-09-14", trackedMin: 0, habitTicks: 0 },
    ]);
  });

  it("handles a user with no activity at all", () => {
    expect(sparklineDays(undefined, TODAY, 2).every((d) => d.trackedMin === 0)).toBe(true);
  });
});

describe("isOpeningNotDoing", () => {
  const NOW = Date.parse("2026-09-14T18:00:00Z");

  it("flags someone who opened recently but did nothing this week", () => {
    const u = user({ lastSeenAt: "2026-09-14T09:00:00+00:00", lastActiveOn: "2026-08-20" });
    expect(isOpeningNotDoing(u, NOW)).toBe(true);
  });

  it("doesn't flag someone who opened and did something", () => {
    const u = user({ lastSeenAt: "2026-09-14T09:00:00+00:00", lastActiveOn: TODAY });
    expect(isOpeningNotDoing(u, NOW)).toBe(false);
  });

  it("doesn't flag someone who hasn't opened in over a week", () => {
    const u = user({ lastSeenAt: "2026-09-01T09:00:00+00:00" });
    expect(isOpeningNotDoing(u, NOW)).toBe(false);
  });

  it("can't flag anyone before last_seen_at has data", () => {
    expect(isOpeningNotDoing(user(), NOW)).toBe(false);
  });
});

describe("sortUsers", () => {
  it("sorts newest first with nulls last", () => {
    const a = user({ displayName: "A", lastActiveOn: "2026-09-01" });
    const b = user({ displayName: "B", lastActiveOn: null });
    const c = user({ displayName: "C", lastActiveOn: "2026-09-10" });
    expect(sortUsers([a, b, c], "active").map((u) => u.displayName)).toEqual(["C", "A", "B"]);
  });

  it("compares timestamps as instants, not strings", () => {
    // 09:00-05:00 is 14:00Z, the later instant, but sorts first as a string.
    const earlier = user({ displayName: "earlier", lastSeenAt: "2026-09-14T10:00:00+00:00" });
    const later = user({ displayName: "later", lastSeenAt: "2026-09-14T09:00:00-05:00" });
    expect(sortUsers([earlier, later], "opened").map((u) => u.displayName)).toEqual([
      "later",
      "earlier",
    ]);
  });

  it("breaks ties by name so the order is stable", () => {
    const b = user({ displayName: "Bea", lastActiveOn: TODAY });
    const a = user({ displayName: "Ann", lastActiveOn: TODAY });
    expect(sortUsers([b, a], "active").map((u) => u.displayName)).toEqual(["Ann", "Bea"]);
  });
});
