import { describe, expect, it } from "vitest";

import {
  MAX_GOAL_LINES,
  buildFriendsWeekRows,
  buildLeaderboardRow,
  leaderboardWeekWindow,
  rankLeaderboard,
} from "@/lib/leaderboard";
import type { PublicUser } from "@/lib/db/friends";
import type { Session } from "@/lib/storage";

const HOUR = 3_600_000;

// Monday-ish window; the exact instants don't matter, only that sessions land
// inside it.
const WEEK_START = 0;
const WEEK_END = 7 * 24 * HOUR;
const NOW = 3 * 24 * HOUR;

let idc = 0;
function sess(over: Partial<Session> = {}): Session {
  return {
    id: `s${idc++}`,
    categoryId: "c1",
    goalId: null,
    taskName: "t",
    startedAt: HOUR,
    endedAt: 2 * HOUR,
    pausedMs: 0,
    pausedSince: null,
    isPrivate: false,
    photoPath: null,
    autoEndedAt: null,
    autoEndReviewedAt: null,
    plannedWorkMs: null,
    workIntervalMs: null,
    breakMs: null,
    onBreak: false,
    breaksTaken: 0,
    planReviewedAt: null,
    ...over,
  };
}

// A session of `ms` attributed to `goalId` (null = category-tracked).
function work(ms: number, goalId: string | null = null): Session {
  const start = HOUR;
  return sess({ goalId, categoryId: goalId ? null : "c1", startedAt: start, endedAt: start + ms });
}

const user: PublicUser = {
  userId: "u1",
  username: "alex",
  displayName: "Alex",
  bio: null,
  avatarUrl: null,
};

function build(sessions: Session[], titles: Record<string, string> = {}) {
  return buildLeaderboardRow(
    user,
    false,
    sessions,
    new Map(
      Object.entries(titles).map(([id, title]) => [id, { title, color: null }])
    ),
    WEEK_START,
    WEEK_END,
    NOW
  );
}

describe("buildLeaderboardRow", () => {
  it("itemises named goals and totals everything", () => {
    const row = build([work(3 * HOUR, "g1"), work(HOUR, "g2")], {
      g1: "Thesis",
      g2: "Spanish",
    });
    expect(row.totalMs).toBe(4 * HOUR);
    expect(row.goals).toEqual([
      { id: "g1", title: "Thesis", color: null, ms: 3 * HOUR },
      { id: "g2", title: "Spanish", color: null, ms: HOUR },
    ]);
    expect(row.otherMs).toBe(0);
  });

  // Category time is never itemised — it's the "overall total, goal breakdown"
  // rule, and it's why Other exists at all.
  it("puts category-tracked time in Other, not in a goal line", () => {
    const row = build([work(2 * HOUR, null), work(HOUR, "g1")], { g1: "Thesis" });
    expect(row.totalMs).toBe(3 * HOUR);
    expect(row.goals).toEqual([
      { id: "g1", title: "Thesis", color: null, ms: HOUR },
    ]);
    expect(row.otherMs).toBe(2 * HOUR);
  });

  // THE privacy boundary. A friend's private goal doesn't resolve to a title
  // (RLS drops it from the titles read), so its hours count toward the total
  // but its name can never appear. Reached by the title being absent rather
  // than by remembering to filter — the same way the feed enforces it.
  it("counts a private goal's hours but never names it", () => {
    const row = build([work(2 * HOUR, "gPrivate"), work(HOUR, "g1")], {
      g1: "Thesis",
      // gPrivate deliberately absent — this is what RLS produces.
    });
    expect(row.totalMs).toBe(3 * HOUR);
    expect(row.goals).toEqual([
      { id: "g1", title: "Thesis", color: null, ms: HOUR },
    ]);
    expect(row.otherMs).toBe(2 * HOUR);
    // Nor is it counted: "1 goal this week" can't hint that a hidden one exists.
    expect(row.goalCount).toBe(1);
    expect(JSON.stringify(row)).not.toContain("gPrivate");
  });

  it("caps goal lines and folds the rest into Other", () => {
    const row = build(
      [
        work(5 * HOUR, "g1"),
        work(4 * HOUR, "g2"),
        work(3 * HOUR, "g3"),
        work(2 * HOUR, "g4"),
        work(HOUR, "g5"),
      ],
      { g1: "A", g2: "B", g3: "C", g4: "D", g5: "E" }
    );
    expect(row.goals).toHaveLength(MAX_GOAL_LINES);
    expect(row.goals.map((g) => g.title)).toEqual(["A", "B", "C"]);
    expect(row.otherMs).toBe(3 * HOUR); // D + E
    // The count isn't capped with the lines.
    expect(row.goalCount).toBe(5);
  });

  // The invariant that stops Other ever looking like a bug, whatever it absorbs.
  it("always reconciles: goals + other === total", () => {
    for (const sessions of [
      [work(HOUR, "g1")],
      [work(HOUR, null)],
      [work(HOUR, "gPrivate")],
      [work(5 * HOUR, "g1"), work(4 * HOUR, "g2"), work(3 * HOUR, "g3"), work(2 * HOUR, "g4")],
      [],
    ]) {
      const row = build(sessions, { g1: "A", g2: "B", g3: "C", g4: "D" });
      const sum = row.goals.reduce((s, g) => s + g.ms, 0) + row.otherMs;
      expect(sum).toBe(row.totalMs);
    }
  });

  it("is empty for someone who tracked nothing", () => {
    const row = build([]);
    expect(row.totalMs).toBe(0);
    expect(row.goals).toEqual([]);
    expect(row.otherMs).toBe(0);
  });
});

describe("rankLeaderboard", () => {
  const row = (id: string, totalMs: number, isMe = false) => ({
    user: { ...user, userId: id, username: id },
    isMe,
    totalMs,
    goals: [],
    goalCount: 0,
    otherMs: totalMs,
  });

  it("ranks by total, highest first", () => {
    const out = rankLeaderboard([row("a", HOUR), row("b", 3 * HOUR), row("c", 2 * HOUR)]);
    expect(out.map((r) => r.user.userId)).toEqual(["b", "c", "a"]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("drops friends who tracked nothing this week", () => {
    const out = rankLeaderboard([row("a", HOUR), row("b", 0)]);
    expect(out.map((r) => r.user.userId)).toEqual(["a"]);
  });

  // Vanishing from your own leaderboard is disorienting, and seeing yourself at
  // the bottom on zero is the nudge the feature exists for.
  it("always keeps you, even at zero", () => {
    const out = rankLeaderboard([row("a", HOUR), row("me", 0, true)]);
    expect(out.map((r) => r.user.userId)).toEqual(["a", "me"]);
    expect(out[1].rank).toBe(2);
  });

  it("returns nothing when nobody tracked and there's no viewer row", () => {
    expect(rankLeaderboard([row("a", 0), row("b", 0)])).toEqual([]);
  });
});

// The week the rows are measured over is the CALLER's, in their stored zone —
// it used to be the server's (UTC on Vercel), which put a Los Angeles user's
// Sunday evening in the NEXT week.
describe("leaderboardWeekWindow", () => {
  const LA = "America/Los_Angeles";
  const at = (iso: string) => Date.parse(iso);

  it("is the caller's Monday to Sunday, not the server's", () => {
    // Sunday Oct 11, 8pm in Los Angeles — already Monday Oct 12 in UTC.
    const now = at("2026-10-12T03:00:00Z");
    const w = leaderboardWeekWindow(LA, now);
    expect(w.weekStartISO).toBe("2026-10-05");
    expect(w.weekStartMs).toBe(at("2026-10-05T07:00:00Z")); // Mon 00:00 PDT
    expect(w.weekEndMs).toBe(at("2026-10-12T07:00:00Z") - 1); // Sun 23:59:59.999 PDT
    // The old window had already rolled over.
    expect(leaderboardWeekWindow("UTC", now).weekStartISO).toBe("2026-10-12");
  });

  it("works east of UTC too", () => {
    // Monday Oct 12, 1am in Tokyo — still Sunday in UTC.
    const w = leaderboardWeekWindow("Asia/Tokyo", at("2026-10-11T16:00:00Z"));
    expect(w.weekStartISO).toBe("2026-10-12");
    expect(w.weekStartMs).toBe(at("2026-10-11T15:00:00Z"));
  });

  // US clocks fall back on Sunday Nov 1 2026, so that week is 169 hours long.
  it("spans a DST week's extra hour", () => {
    const w = leaderboardWeekWindow(LA, at("2026-10-30T19:00:00Z"));
    expect(w.weekStartISO).toBe("2026-10-26");
    expect(w.weekStartMs).toBe(at("2026-10-26T07:00:00Z")); // PDT
    expect(w.weekEndMs).toBe(at("2026-11-02T08:00:00Z") - 1); // PST
    expect(w.weekEndMs + 1 - w.weekStartMs).toBe(169 * HOUR);
  });

  // UTC is what the window always was before the fix, so a profile with no
  // zone sees no change; a bad zone must not throw and take /friends down.
  it("falls back to UTC for a missing or unparseable zone", () => {
    const now = at("2026-10-12T03:00:00Z");
    const utc = leaderboardWeekWindow("UTC", now);
    expect(leaderboardWeekWindow(null, now)).toEqual(utc);
    expect(leaderboardWeekWindow(undefined, now)).toEqual(utc);
    expect(leaderboardWeekWindow("", now)).toEqual(utc);
    expect(leaderboardWeekWindow("Not/AZone", now)).toEqual(utc);
  });
});

describe("buildFriendsWeekRows", () => {
  const LA = "America/Los_Angeles";
  const at = (iso: string) => Date.parse(iso);
  const person = (id: string, isMe = false) => ({
    user: { ...user, userId: id, username: id },
    isMe,
  });
  const span = (from: string, to: string, goalId: string | null = null) =>
    sess({
      goalId,
      categoryId: goalId ? null : "c1",
      startedAt: at(from),
      endedAt: at(to),
    });
  const noGoals = new Map<string, { title: string; color: string | null }>();

  it("keeps one row per person, in order, zero-hour friends included", () => {
    const rows = buildFriendsWeekRows(
      [person("me", true), person("f1"), person("f2")],
      new Map([["f1", [work(2 * HOUR)]]]),
      noGoals,
      { weekStartMs: WEEK_START, weekEndMs: WEEK_END },
      NOW
    );
    expect(rows.map((r) => [r.user.userId, r.isMe, r.totalMs])).toEqual([
      ["me", true, 0],
      ["f1", false, 2 * HOUR],
      ["f2", false, 0],
    ]);
    expect(rows.every((r) => !("rank" in r))).toBe(true);
    // Ranking them is exactly what the live leaderboard did before the split:
    // the zero-hour friend drops, the caller stays.
    expect(rankLeaderboard(rows).map((r) => [r.user.userId, r.rank])).toEqual([
      ["f1", 1],
      ["me", 2],
    ]);
  });

  // The bug the window fixes, end to end: on Sunday evening in Los Angeles a
  // Wednesday session is still this week's, where the UTC week had already
  // turned over and showed nothing.
  it("counts the caller's week, not the server's", () => {
    const now = at("2026-10-12T03:00:00Z"); // Sun 8pm PDT
    const wed = span("2026-10-07T17:00:00Z", "2026-10-07T19:00:00Z"); // Wed 10am–noon PDT
    const people = [person("me", true)];
    const sessions = new Map([["me", [wed]]]);
    const la = buildFriendsWeekRows(people, sessions, noGoals, leaderboardWeekWindow(LA, now), now);
    const utc = buildFriendsWeekRows(people, sessions, noGoals, leaderboardWeekWindow("UTC", now), now);
    expect(la[0].totalMs).toBe(2 * HOUR);
    expect(utc[0].totalMs).toBe(0);
  });

  it("attributes across a DST week by the local boundaries", () => {
    const now = at("2026-11-02T07:59:00Z"); // Sun Nov 1, 11:59pm PST
    const week = leaderboardWeekWindow(LA, now);
    const sessions = new Map([
      [
        "me",
        [
          // Sun Oct 25, 11pm PDT: the week before.
          span("2026-10-26T06:00:00Z", "2026-10-26T06:45:00Z"),
          // Mon Oct 26, 12:30am PDT: the first hour of this week.
          span("2026-10-26T07:30:00Z", "2026-10-26T08:00:00Z"),
          // Sun Nov 1, 11pm PST: the last hour, after the clocks fell back.
          span("2026-11-02T07:00:00Z", "2026-11-02T07:30:00Z", "g1"),
        ],
      ],
    ]);
    const [row] = buildFriendsWeekRows(
      [person("me", true)],
      sessions,
      new Map([["g1", { title: "Thesis", color: null }]]),
      week,
      now
    );
    expect(row.totalMs).toBe(HOUR);
    expect(row.goals).toEqual([
      { id: "g1", title: "Thesis", color: null, ms: HOUR / 2 },
    ]);
    expect(row.otherMs).toBe(HOUR / 2);
  });

  it("counts a session that is still running up to now", () => {
    const now = at("2026-10-07T20:00:00Z");
    const running = sess({ startedAt: at("2026-10-07T18:30:00Z"), endedAt: null });
    const [row] = buildFriendsWeekRows(
      [person("f1")],
      new Map([["f1", [running]]]),
      noGoals,
      leaderboardWeekWindow(LA, now),
      now
    );
    expect(row.totalMs).toBe(1.5 * HOUR);
  });
});
