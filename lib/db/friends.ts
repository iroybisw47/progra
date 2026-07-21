import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

// The only shape of another user we ever expose to the client: the three public
// identity columns, read through the public_profiles view (never token columns).
export type PublicUser = {
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
};

export type FriendEntry = { friendshipId: string; user: PublicUser };
export type RequestEntry = { requestId: string; user: PublicUser };
export type BlockedEntry = { user: PublicUser };

type PublicProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
};

// Hydrate public identity for a set of user ids via the narrow view. Mirrors
// getGoalsByIds' empty-guard + .in() pattern (lib/db/goals.ts). Exported so
// other cross-user readers (feed comments) resolve authors the same safe way.
export async function hydrateUsers(
  ids: string[]
): Promise<Map<string, PublicUser>> {
  const map = new Map<string, PublicUser>();
  if (ids.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, bio")
    .in("id", ids);
  if (!data) return map;

  for (const row of data as PublicProfileRow[]) {
    map.set(row.id, {
      userId: row.id,
      username: row.username,
      displayName: row.display_name,
      bio: row.bio,
    });
  }
  return map;
}

// Accepted friendships. RLS returns only rows I'm a participant in.
// Cached per request — the feed's three composers (feed, clocked-in strip,
// joins) each need the friend list; they share one friendships+hydrate read.
export const listFriends = cache(async (): Promise<FriendEntry[]> => {
  const me = await getCurrentUser();
  if (!me) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (!data) return [];

  const rows = data as FriendshipRow[];
  const otherId = (r: FriendshipRow) =>
    r.requester_id === me.id ? r.addressee_id : r.requester_id;
  const users = await hydrateUsers(rows.map(otherId));

  return rows.flatMap((r) => {
    const user = users.get(otherId(r));
    return user ? [{ friendshipId: r.id, user }] : [];
  });
});

// Everyone else on Progra, for the "People on Progra" discovery section. Reads
// the narrow public_profiles view (identity only), excludes me and anyone I've
// blocked. Capped for now — beta is small. Caveat: RLS hides blocks made against
// me, so a user who blocked *me* can still appear; an Add attempt then fails with
// the generic sendFriendRequest error (no block revealed). The client further
// declutters current friends. Empty-safe.
export async function listSuggestedUsers(limit = 100): Promise<PublicUser[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const supabase = await createClient();

  // Ids I've blocked — never suggest them.
  const { data: blockedRows } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "blocked")
    .eq("blocked_by", me.id);
  const blockedIds = new Set<string>();
  for (const r of (blockedRows ?? []) as FriendshipRow[]) {
    blockedIds.add(r.requester_id === me.id ? r.addressee_id : r.requester_id);
  }

  const { data } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, bio")
    .neq("id", me.id)
    .order("username", { ascending: true })
    .limit(limit);
  if (!data) return [];

  return (data as PublicProfileRow[])
    .filter((r) => !blockedIds.has(r.id))
    .map((r) => ({
      userId: r.id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio,
    }));
}

// Pending requests where I'm the addressee (someone asked to be my friend).
export async function listIncomingRequests(): Promise<RequestEntry[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .eq("status", "pending")
    .eq("addressee_id", me.id)
    .order("created_at", { ascending: false });
  if (!data) return [];

  const rows = data as FriendshipRow[];
  const users = await hydrateUsers(rows.map((r) => r.requester_id));
  return rows.flatMap((r) => {
    const user = users.get(r.requester_id);
    return user ? [{ requestId: r.id, user }] : [];
  });
}

// Pending requests I sent (awaiting the other person's response).
export async function listOutgoingRequests(): Promise<RequestEntry[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .eq("status", "pending")
    .eq("requester_id", me.id)
    .order("created_at", { ascending: false });
  if (!data) return [];

  const rows = data as FriendshipRow[];
  const users = await hydrateUsers(rows.map((r) => r.addressee_id));
  return rows.flatMap((r) => {
    const user = users.get(r.addressee_id);
    return user ? [{ requestId: r.id, user }] : [];
  });
}

// Users I've blocked. RLS shows a block row only to its blocker, so this is
// inherently scoped to me; the extra blocked_by filter is defensive.
export async function listBlockedUsers(): Promise<BlockedEntry[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .eq("status", "blocked")
    .eq("blocked_by", me.id)
    .order("created_at", { ascending: false });
  if (!data) return [];

  const rows = data as FriendshipRow[];
  const otherId = (r: FriendshipRow) =>
    r.requester_id === me.id ? r.addressee_id : r.requester_id;
  const users = await hydrateUsers(rows.map(otherId));
  return rows.flatMap((r) => {
    const user = users.get(otherId(r));
    return user ? [{ user }] : [];
  });
}
