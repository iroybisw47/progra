import { describe, expect, it } from "vitest";

import {
  MAX_GOAL_LINES,
  buildLeaderboardRow,
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
    new Map(Object.entries(titles)),
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
      { id: "g1", title: "Thesis", ms: 3 * HOUR },
      { id: "g2", title: "Spanish", ms: HOUR },
    ]);
    expect(row.otherMs).toBe(0);
  });

  // Category time is never itemised — it's the "overall total, goal breakdown"
  // rule, and it's why Other exists at all.
  it("puts category-tracked time in Other, not in a goal line", () => {
    const row = build([work(2 * HOUR, null), work(HOUR, "g1")], { g1: "Thesis" });
    expect(row.totalMs).toBe(3 * HOUR);
    expect(row.goals).toEqual([{ id: "g1", title: "Thesis", ms: HOUR }]);
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
    expect(row.goals).toEqual([{ id: "g1", title: "Thesis", ms: HOUR }]);
    expect(row.otherMs).toBe(2 * HOUR);
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
