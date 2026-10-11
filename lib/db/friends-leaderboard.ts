import "server-only";

import { cache } from "react";

import {
  buildFriendsWeekRows,
  leaderboardWeekWindow,
  rankLeaderboard,
  type FriendsLeaderboardRow,
  type FriendsWeekRow,
} from "@/lib/leaderboard";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { hydrateGoals } from "@/lib/db/feed";
import { listFriends, type PublicUser } from "@/lib/db/friends";
import { SESSION_COLUMNS, rowToSession, type SessionRow } from "@/lib/db/sessions";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/storage";

type Row = SessionRow & { user_id: string };

// This week's hours for the caller's circle: one UNRANKED row per person, the
// caller first (isMe), then each accepted friend in listFriends' order, with
// zero-hour friends kept. Module-private: the leaderboard ranks the whole
// circle (getFriendsLeaderboard), and everything else reads friends only
// (getFriendsWeekRows), so no consumer has to remember to drop the caller.
//
// Deliberately NOT the week_leaderboard RPC, which returns totals only. Doing
// the aggregation here reuses aggregateRangeByGoal — the one implementation of
// worked-time bucketing — instead of the RPC's SQL replica of it, so these
// hours can't drift from the Progress tab the way two copies eventually do.
// The week is the caller's own (leaderboardWeekWindow), the window Progress
// uses too. It is NOT the Goals page's or the Dashboard's (/, /me): those still
// use the server's week (UTC on Vercel), so near a week boundary their hours
// can legitimately differ from these until they move to weekWindow(tz).
//
// Security is unchanged: listFriends() bounds the circle to accepted friends,
// and sessions RLS (owner OR are_friends AND NOT is_private) independently
// decides what actually returns. A friend's private sessions never arrive here
// at all. Calendar events are excluded for free — they're a different table,
// matching the RPC's deliberate "a packed calendar shouldn't win".
const getCircleWeekRows = cache(
  async (): Promise<FriendsWeekRow[]> => {
    const me = await getCurrentUser();
    if (!me) return [];

    // getProfile is cache()-wrapped and the layout already fetched it, so it
    // costs nothing here; it is read up front now because the week depends on
    // the caller's timezone. It also builds the caller's own row below.
    const [friends, profile] = await Promise.all([listFriends(), getProfile()]);
    const now = Date.now();
    const { weekStartMs, weekEndMs } = leaderboardWeekWindow(
      profile?.timezone,
      now
    );

    const userIds = [me.id, ...friends.map((f) => f.user.userId)];

    const supabase = await createClient();
    // Overlap rather than "ended in window": a session running right now has no
    // ended_at, and one started before Monday still contributes. Attribution to
    // the window is then aggregateRangeByGoal's job.
    const { data } = await supabase
      .from("sessions")
      .select(`${SESSION_COLUMNS}, user_id`)
      .in("user_id", userIds)
      .lt("started_at", new Date(weekEndMs).toISOString())
      .or(`ended_at.gt.${new Date(weekStartMs).toISOString()},ended_at.is.null`);

    const byUser = new Map<string, Session[]>();
    for (const row of (data ?? []) as Row[]) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(rowToSession(row));
      byUser.set(row.user_id, list);
    }

    // One batched titles read. RLS drops friends' private goals, which is what
    // keeps their names out of the breakdown.
    const goalIds = [
      ...new Set(
        ((data ?? []) as Row[])
          .map((r) => r.goal_id)
          .filter((id): id is string => id !== null)
      ),
    ];
    const goalById = await hydrateGoals(goalIds);

    // listFriends never includes the caller, so their own row is built here —
    // from the profile, so your avatar and handle render exactly as a friend's
    // does rather than via a placeholder.
    const people: { user: PublicUser; isMe: boolean }[] = [
      {
        user: {
          userId: me.id,
          username: profile?.username ?? "you",
          displayName: profile?.display_name ?? null,
          bio: null,
          avatarUrl: avatarPublicUrl(profile?.avatar_path ?? null),
        },
        isMe: true,
      },
      ...friends.map((f) => ({ user: f.user, isMe: false })),
    ];

    return buildFriendsWeekRows(
      people,
      byUser,
      goalById,
      { weekStartMs, weekEndMs },
      now
    );
  }
);

// One unranked row per accepted friend — never the caller — in listFriends'
// order, zero-hour friends kept. What onboarding v3's Screen 5 and the v3
// Friends tab's "Your friends" list read: rankLeaderboard drops anyone at zero,
// and a friend who hasn't tracked anything this week still belongs there.
// Shares the read with getFriendsLeaderboard in the same request.
export const getFriendsWeekRows = cache(
  async (): Promise<FriendsWeekRow[]> =>
    (await getCircleWeekRows()).filter((r) => !r.isMe)
);

// This week's leaderboard: the caller's circle, ranked, with zero-hour friends
// dropped and the caller always kept (rankLeaderboard).
export const getFriendsLeaderboard = cache(
  async (): Promise<FriendsLeaderboardRow[]> =>
    rankLeaderboard(await getCircleWeekRows())
);
