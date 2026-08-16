import "server-only";

import { cache } from "react";

import {
  buildLeaderboardRow,
  rankLeaderboard,
  type FriendsLeaderboardRow,
} from "@/lib/leaderboard";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { endOfWeek, startOfWeek } from "@/lib/dates";
import { hydrateGoalTitles } from "@/lib/db/feed";
import { listFriends, type PublicUser } from "@/lib/db/friends";
import { SESSION_COLUMNS, rowToSession, type SessionRow } from "@/lib/db/sessions";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/storage";

type Row = SessionRow & { user_id: string };

// This week's leaderboard for the caller + their accepted friends.
//
// Deliberately NOT the week_leaderboard RPC, which returns totals only. Doing
// the aggregation here reuses aggregateRangeByGoal — the one implementation of
// worked-time bucketing — instead of the RPC's SQL replica of it, so the
// leaderboard can't drift from the Goals page the way two copies eventually do.
//
// Security is unchanged: listFriends() bounds the circle to accepted friends,
// and sessions RLS (owner OR are_friends AND NOT is_private) independently
// decides what actually returns. A friend's private sessions never arrive here
// at all. Calendar events are excluded for free — they're a different table,
// matching the RPC's deliberate "a packed calendar shouldn't win".
export const getFriendsLeaderboard = cache(
  async (): Promise<FriendsLeaderboardRow[]> => {
    const me = await getCurrentUser();
    if (!me) return [];

    const friends = await listFriends();
    const now = Date.now();
    const weekStartMs = startOfWeek(new Date(now)).getTime();
    const weekEndMs = endOfWeek(new Date(now)).getTime();

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
    const goalTitleById = await hydrateGoalTitles(goalIds);

    // listFriends never includes the caller, so their own row is built here.
    // getProfile is cache()-wrapped and the layout already fetched it, so this
    // costs nothing — and it means your avatar and handle render exactly as a
    // friend's does rather than via a placeholder.
    const profile = await getProfile();
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

    return rankLeaderboard(
      people.map((p) =>
        buildLeaderboardRow(
          p.user,
          p.isMe,
          byUser.get(p.user.userId) ?? [],
          goalTitleById,
          weekStartMs,
          weekEndMs,
          now
        )
      )
    );
  }
);
