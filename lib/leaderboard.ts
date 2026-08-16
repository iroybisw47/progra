import { aggregateRangeByGoal } from "@/lib/aggregate";
import type { PublicUser } from "@/lib/db/friends";
import type { Session } from "@/lib/storage";

// The leaderboard's RULES, kept pure and free of `server-only` so they can be
// tested directly — the same split as lib/session.ts (pure maths) versus
// lib/db/* (reads). The database half lives in lib/db/friends-leaderboard.ts.

// How many named goals get their own line before the rest folds into "Other".
// Live data: one account has 8 active goals and one has 6, everyone else 1–4 —
// so three keeps rows scannable without hiding much from anyone.
export const MAX_GOAL_LINES = 3;

export type LeaderboardGoal = { title: string; ms: number };

export type FriendsLeaderboardRow = {
  user: PublicUser;
  rank: number;
  isMe: boolean;
  totalMs: number;
  // Named, visible goals, biggest first, at most MAX_GOAL_LINES.
  goals: LeaderboardGoal[];
  // Everything not itemised above: category-tracked time, private goals, and
  // goals past the cap. Always exactly totalMs − Σ(goals), so the numbers
  // reconcile no matter what fell into it.
  otherMs: number;
};

// Builds one leaderboard row from a person's sessions.
//
// A goal title is only present when the goal is visible to us: RLS drops a
// friend's private goals from the titles read, so an unresolved id folds into
// `otherMs` and a private goal's name can never surface. That's the same
// boundary resolveFeedAttribution enforces for the feed, reached the same way
// — by the title simply not being there — rather than by remembering to filter.
export function buildLeaderboardRow(
  user: PublicUser,
  isMe: boolean,
  sessions: Session[],
  goalTitleById: Map<string, string>,
  weekStartMs: number,
  weekEndMs: number,
  now: number
): Omit<FriendsLeaderboardRow, "rank"> {
  // The same function the Goals page, recaps and rollups use, so these numbers
  // agree with those surfaces by construction rather than by replication.
  const { perGoal, total } = aggregateRangeByGoal(
    sessions,
    weekStartMs,
    weekEndMs,
    now
  );

  const named: LeaderboardGoal[] = [];
  for (const [goalId, ms] of perGoal) {
    const title = goalTitleById.get(goalId);
    if (title) named.push({ title, ms });
  }
  named.sort((a, b) => b.ms - a.ms);
  const goals = named.slice(0, MAX_GOAL_LINES);

  return {
    user,
    isMe,
    totalMs: total,
    goals,
    // Derived, never accumulated: whatever didn't get a line — categories,
    // private goals, goals past the cap — is exactly the remainder.
    otherMs: Math.max(0, total - goals.reduce((sum, g) => sum + g.ms, 0)),
  };
}

// Ranks people by total, drops anyone at zero, and always keeps the caller —
// vanishing from your own leaderboard is disorienting, and seeing yourself at
// the bottom on zero is the nudge the feature exists for.
export function rankLeaderboard(
  rows: Omit<FriendsLeaderboardRow, "rank">[]
): FriendsLeaderboardRow[] {
  return rows
    .filter((r) => r.totalMs > 0 || r.isMe)
    .sort((a, b) => b.totalMs - a.totalMs)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
