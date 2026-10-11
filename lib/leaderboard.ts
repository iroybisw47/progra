import { aggregateRangeByGoal } from "@/lib/aggregate";
import { isoDateInTimeZone, weekWindow, type WeekWindow } from "@/lib/dates";
import type { PublicUser } from "@/lib/db/friends";
import type { Session } from "@/lib/storage";

// The leaderboard's RULES, kept pure and free of `server-only` so they can be
// tested directly — the same split as lib/session.ts (pure maths) versus
// lib/db/* (reads). The database half lives in lib/db/friends-leaderboard.ts.

// How many named goals get their own line before the rest folds into "Other".
// Live data: one account has 8 active goals and one has 6, everyone else 1–4 —
// so three keeps rows scannable without hiding much from anyone.
export const MAX_GOAL_LINES = 3;

// `id` and `color` carry no new information — the row is already only built
// from goals whose titles resolved — but together they let the UI paint each
// goal in its own hue (goalColorOf), the same one it has on its owner's
// Progress tab.
export type LeaderboardGoal = {
  id: string;
  title: string;
  color: string | null;
  ms: number;
};

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

// A row before ranking: one per person, zero-hour people included.
export type FriendsWeekRow = Omit<FriendsLeaderboardRow, "rank">;

// The week every row is measured over: the CALLER's Monday to Sunday, in their
// stored timezone. That is the window the Progress tab uses
// (lib/db/progress.ts), so "this week" here is the week Progress shows, and it
// is the week the board's "resets in" label counts down to on the device
// (EnsureProfileSync keeps the stored zone equal to the device's). Until
// 2026-10-09 it was the server's own timezone — UTC on Vercel — which turned a
// Los Angeles user's week over at 5pm on Sunday.
//
// Pinned to `now` rather than weekWindow's own clock so a test can fix the
// instant. No timezone falls back to UTC, which is what the server window
// always was. So does an unparseable one: Intl throws a RangeError on a bad
// zone, and a bad string in profiles.timezone must not take /friends down.
export function leaderboardWeekWindow(
  tz: string | null | undefined,
  now: number
): WeekWindow {
  const zone = tz || "UTC";
  try {
    return weekWindow(zone, isoDateInTimeZone(now, zone));
  } catch {
    return weekWindow("UTC", isoDateInTimeZone(now, "UTC"));
  }
}

// Builds one leaderboard row from a person's sessions.
//
// A goal is only present when it's visible to us: RLS drops a
// friend's private goals from the read, so an unresolved id folds into
// `otherMs` and a private goal's name can never surface. That's the same
// boundary resolveFeedAttribution enforces for the feed, reached the same way
// — by the title simply not being there — rather than by remembering to filter.
export function buildLeaderboardRow(
  user: PublicUser,
  isMe: boolean,
  sessions: Session[],
  goalById: Map<string, { title: string; color: string | null }>,
  weekStartMs: number,
  weekEndMs: number,
  now: number
): FriendsWeekRow {
  // The same bucketing function the Goals page, recaps and rollups use, so
  // these numbers can't drift from theirs by replication. Agreement with a
  // given surface still needs the same window: the caller passes the
  // caller's-timezone week (leaderboardWeekWindow), which is Progress's, while
  // the Goals page and the Dashboard still use the server's (UTC) week.
  const { perGoal, total } = aggregateRangeByGoal(
    sessions,
    weekStartMs,
    weekEndMs,
    now
  );

  const named: LeaderboardGoal[] = [];
  for (const [goalId, ms] of perGoal) {
    const goal = goalById.get(goalId);
    if (goal) named.push({ id: goalId, title: goal.title, color: goal.color, ms });
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

// One unranked row per person, in the order given — nobody is dropped, and a
// person with no sessions gets an all-zero row. Ranking, and dropping the
// zeros, is rankLeaderboard's job; onboarding v3 and the v3 Friends tab read
// these rows as they are (friends only — getFriendsWeekRows drops the
// caller's row), because a friend who hasn't tracked anything this week still
// belongs in "Your friends". Every row is measured over the same window
// (leaderboardWeekWindow), so the rows compare.
export function buildFriendsWeekRows(
  people: readonly { user: PublicUser; isMe: boolean }[],
  sessionsByUser: ReadonlyMap<string, Session[]>,
  goalById: Map<string, { title: string; color: string | null }>,
  week: Pick<WeekWindow, "weekStartMs" | "weekEndMs">,
  now: number
): FriendsWeekRow[] {
  return people.map((p) =>
    buildLeaderboardRow(
      p.user,
      p.isMe,
      sessionsByUser.get(p.user.userId) ?? [],
      goalById,
      week.weekStartMs,
      week.weekEndMs,
      now
    )
  );
}

// Ranks people by total, drops anyone at zero, and always keeps the caller —
// vanishing from your own leaderboard is disorienting, and seeing yourself at
// the bottom on zero is the nudge the feature exists for.
export function rankLeaderboard(
  rows: readonly FriendsWeekRow[]
): FriendsLeaderboardRow[] {
  return rows
    .filter((r) => r.totalMs > 0 || r.isMe)
    .sort((a, b) => b.totalMs - a.totalMs)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
