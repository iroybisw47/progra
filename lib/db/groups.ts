import "server-only";

import { cache } from "react";

import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import { readFeedForFriends, type FeedItem } from "@/lib/db/feed";
import {
  getFriendRelations,
  hydrateUsers,
  listFriends,
  type PublicUser,
} from "@/lib/db/friends";
import { GROUPS } from "@/lib/flags";
import {
  rankGroupRows,
  rowToGroupSummary,
  type GroupLeaderRow,
  type GroupSummary,
  type ListGroupsRow,
} from "@/lib/groups";
import { leaderboardWeekWindow } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Group reads (.claude/plans/groups.sql). Every co-member read is a DEFINER
// RPC, never a table read: group_members' RLS shows you only your own rows, so
// a blocked pair can't find each other through the raw API, and the RPCs drop
// blocked pairs both ways. Identity still comes through public_profiles
// (hydrateUsers), like every other list of people. Each returns empty on any
// error — including before the SQL has run — and nothing at all with GROUPS
// off.

// The instant this request reads at: the clock the group page's cards
// measure "2h ago" against, read in the data layer (as lib/db/feed.ts reads
// its own) rather than in a component's render. One value per request.
export const requestNow = cache((): number => Date.now());

// Every live group, oldest first, with your membership and the join line's
// count.
export const listGroups = cache(async (): Promise<GroupSummary[]> => {
  if (!GROUPS) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_groups");
  if (error || !Array.isArray(data)) return [];
  return (data as ListGroupsRow[]).map(rowToGroupSummary);
});

// One live group, or null (unknown, archived, or a malformed id) — the page's
// 404.
export const getGroup = cache(async (groupId: string): Promise<GroupSummary | null> => {
  if (!isUuid(groupId)) return null;
  return (await listGroups()).find((g) => g.groupId === groupId) ?? null;
});

export type GroupMemberRelation =
  | { kind: "self" }
  | { kind: "friends" }
  | { kind: "outgoing"; requestId: string }
  | { kind: "incoming"; requestId: string }
  | { kind: "none" };

export type GroupMember = { user: PublicUser; relation: GroupMemberRelation };

// The members you may see, in the order they joined, each with what you are
// to them — which decides the row's Unfriend / Add friend / Requested /
// Accept. Empty unless you're a member. A member with no handle yet (never
// onboarded) is left out, as hydrateUsers leaves them out everywhere.
export const listGroupMembers = cache(async (groupId: string): Promise<GroupMember[]> => {
  if (!GROUPS || !isUuid(groupId)) return [];
  const me = await getCurrentUser();
  if (!me) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_group_members", { p_group: groupId });
  if (error || !Array.isArray(data)) return [];
  const ids = (data as { user_id: string }[]).map((r) => r.user_id);

  const [users, relations] = await Promise.all([hydrateUsers(ids), getFriendRelations()]);
  const friendIds = new Set(relations.friendIds);
  const outgoing = new Map(relations.outgoing.map((r) => [r.userId, r.requestId]));
  const incoming = new Map(relations.incoming.map((r) => [r.userId, r.requestId]));

  return ids.flatMap((id) => {
    const user = users.get(id);
    if (!user) return [];
    const relation: GroupMemberRelation =
      id === me.id
        ? { kind: "self" }
        : friendIds.has(id)
          ? { kind: "friends" }
          : outgoing.has(id)
            ? { kind: "outgoing", requestId: outgoing.get(id)! }
            : incoming.has(id)
              ? { kind: "incoming", requestId: incoming.get(id)! }
              : { kind: "none" };
    return [{ user, relation }];
  });
});

// A week's leaderboard for one group: every member you may see, ranked, zero
// hours included (lib/groups.ts rankGroupRows). The totals are the definer's
// — group_leaderboard counts private sessions as a bare number and returns
// nothing else of anyone's. M in "#N of M" is this list's length, so it is
// counted after the handle-less are dropped.
export const getGroupLeaderboard = cache(
  async (groupId: string, weekStartMs: number, weekEndMs: number): Promise<GroupLeaderRow[]> => {
    if (!GROUPS || !isUuid(groupId)) return [];
    const me = await getCurrentUser();
    if (!me) return [];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("group_leaderboard", {
      p_group: groupId,
      p_start_ms: weekStartMs,
      p_end_ms: weekEndMs,
    });
    if (error || !Array.isArray(data)) return [];
    const rows = data as { user_id: string; tracked_ms: number | string }[];

    const users = await hydrateUsers(rows.map((r) => r.user_id));
    return rankGroupRows(
      rows.flatMap((r) => {
        const user = users.get(r.user_id);
        return user ? [{ user, isMe: r.user_id === me.id, totalMs: Number(r.tracked_ms) }] : [];
      })
    );
  }
);

// This week's board, in the caller's own week (their timezone's Monday to
// Sunday) — the week Progress and the Friends tab's hours count, so a
// member's total here is the one their Progress tab shows.
export const getGroupLeaderboardThisWeek = cache(async (groupId: string): Promise<GroupLeaderRow[]> => {
  const profile = await getProfile();
  const { weekStartMs, weekEndMs } = leaderboardWeekWindow(profile?.timezone, Date.now());
  return getGroupLeaderboard(groupId, weekStartMs, weekEndMs);
});

// Your rank in each of your groups over a week — the weekly review's rank
// slide, one row per group. `of` under GROUP_LEADERBOARD_MIN is for the reader
// to show "Invite your group" rather than a rank.
export type MyGroupRank = { groupId: string; name: string; rank: number; of: number };

export const getMyGroupRanksForWeek = cache(
  async (weekStartMs: number, weekEndMs: number): Promise<MyGroupRank[]> => {
    const mine = (await listGroups()).filter((g) => g.isMember);
    const boards = await Promise.all(
      mine.map((g) => getGroupLeaderboard(g.groupId, weekStartMs, weekEndMs))
    );
    return mine.flatMap((g, i) => {
      const me = boards[i].find((r) => r.isMe);
      return me ? [{ groupId: g.groupId, name: g.name, rank: me.rank, of: boards[i].length }] : [];
    });
  }
);

// A group's feed: finished sessions from the members you're friends with,
// through the home feed's own read, so the private rule (RLS: owner OR
// are_friends AND NOT is_private) is the same one, not a copy. Someone you've
// unfriended or blocked isn't a friend, so they aren't here.
export const listGroupFeed = cache(async (groupId: string): Promise<FeedItem[]> => {
  const [members, friends] = await Promise.all([listGroupMembers(groupId), listFriends()]);
  const memberIds = new Set(members.map((m) => m.user.userId));
  return readFeedForFriends(
    friends.filter((f) => memberIds.has(f.user.userId)),
    7
  );
});

// /admin's list: every group, archived ones last, with real member counts.
// Null, not [], when the RPC fails — before groups.sql has run — so the panel
// can say it's not installed rather than "no groups yet".
export type AdminGroup = {
  groupId: string;
  name: string;
  description: string | null;
  memberCap: number;
  memberCount: number;
  archivedAt: number | null;
};

export const adminListGroups = cache(async (): Promise<AdminGroup[] | null> => {
  if (!GROUPS) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_groups");
  if (error || !Array.isArray(data)) return null;
  return (
    data as {
      id: string;
      name: string;
      description: string | null;
      member_cap: number;
      member_count: number;
      archived_at: string | null;
    }[]
  ).map((r) => ({
    groupId: r.id,
    name: r.name,
    description: r.description,
    memberCap: r.member_cap,
    memberCount: r.member_count,
    archivedAt: r.archived_at ? Date.parse(r.archived_at) : null,
  }));
});
