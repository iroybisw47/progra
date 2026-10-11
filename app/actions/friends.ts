"use server";

import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { revalidateFriendSurfaces } from "@/lib/revalidate";
import {
  SEARCH_QUERY_MIN,
  SEARCH_RESULTS_MAX,
  normalizeSearchQuery,
  orderSearchMatches,
} from "@/lib/social/username";
import { isUuid } from "@/lib/validate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { requireSeat } from "@/lib/auth/require-seat";

type Result = { ok: true } | { error: string };

// Every failure below returns fixed text, never the database's own message:
// a PostgREST or RPC error can name a constraint, a column or a definer
// function's `raise exception` text, and none of that is the user's business
// (or theirs to read a block out of). The messages say which thing failed and
// nothing about why.

export type UserSearchResult = {
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

// Send a friend request. RLS's insert policy already restricts this to a
// pending row where requester = me; the guards here are just for a friendlier
// error. A 23505 means a relationship row already exists for the pair — kept
// deliberately generic so a hidden block never reveals itself, which is also
// why every other failure gets the same words.
//
// Returns the new row's id so a caller can undo the request in place
// (cancelFriendRequest(requestId)) — onboarding v3's "Added" toggles back to
// "Add" without a reload. Additive: callers that only read `ok` are unchanged.
// Reading the id back costs nothing extra under RLS: the requester can already
// see their own outgoing pending rows (listOutgoingRequests reads exactly
// those), so the RETURNING row passes the select policy the insert just met.
export async function sendFriendRequest(
  targetUserId: string
): Promise<{ ok: true; requestId: string } | { error: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;
  if (!targetUserId || targetUserId === user.id) {
    return { error: "Couldn't send request." };
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({
      requester_id: user.id,
      addressee_id: targetUserId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't send request." };
  revalidateFriendSurfaces();
  return { ok: true, requestId: (data as { id: string }).id };
}

// Accept an incoming request. Routed through the definer RPC so the DB — not
// app code — enforces that only the addressee of a pending request can accept
// (a requester must not be able to fabricate a friendship via the raw API).
export async function acceptFriendRequest(requestId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const { error } = await supabase.rpc("accept_friend_request", {
    request_id: requestId,
  });
  if (error) return { error: "Couldn't accept request." };
  revalidateFriendSurfaces();
  return { ok: true };
}

// Delete a friendship row: decline an incoming request, cancel an outgoing one,
// or unfriend. RLS's delete policy limits this to rows I'm a participant in.
export async function removeFriendship(id: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) return { error: "Couldn't update that friendship." };
  revalidateFriendSurfaces();
  return { ok: true };
}

// Take back a request I sent that's still pending: onboarding v3's "✓ Added"
// tapped again. Unlike removeFriendship it can only ever delete my own pending
// row, so an undo that lands after the other person accepted can't quietly end
// the friendship. When nothing was deleted the row isn't pending any more:
// accepted meanwhile is an error (the toggle stays on, and the revalidated
// page shows them as a friend); gone (declined, or hidden by a block) means
// there's nothing left to take back, which is what was asked.
export async function cancelFriendRequest(id: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(id)) return { error: "Couldn't take that request back." };

  const { data, error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", id)
    .eq("status", "pending")
    .eq("requester_id", user.id)
    .select("id");
  if (error) return { error: "Couldn't take that request back." };
  revalidateFriendSurfaces();
  if ((data ?? []).length > 0) return { ok: true };

  const { data: row } = await supabase
    .from("friendships")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if ((row as { status: string } | null)?.status === "accepted") {
    return { error: "They've already accepted. You're friends now." };
  }
  return { ok: true };
}

// Block a user. Definer RPC does an atomic upsert to a blocked row (overwriting
// any existing pending/accepted relationship), so blocking works whether or not
// a row already exists.
export async function blockUser(targetUserId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!targetUserId || targetUserId === user.id) {
    return { error: "Couldn't block this user." };
  }

  const { error } = await supabase.rpc("block_user", { target: targetUserId });
  if (error) return { error: "Couldn't block this user." };
  revalidateFriendSurfaces();
  return { ok: true };
}

// Unblock: delete my block row. RLS lets me see (and thus delete) only blocks I
// created, so this can't touch anyone else's.
export async function unblockUser(targetUserId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  // Validate before interpolating into the .or() filter string below — a
  // non-UUID value could otherwise alter the PostgREST filter expression.
  if (!isUuid(targetUserId)) return { error: "Invalid user." };

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("status", "blocked")
    .eq("blocked_by", user.id)
    .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`);
  if (error) return { error: "Couldn't unblock this user." };
  revalidateFriendSurfaces();
  return { ok: true };
}

// Prefix search over public handles/display names. Definer RPC excludes self
// and anyone in a block relationship with me (either direction), so blocks stay
// invisible during discovery. Returns [] for very short queries.
//
// The "@" strip and the five-row cap live HERE, not in the RPC, so they hold
// whichever search_users body is live (the plan's SQL-2 substring rewrite is
// optional and may never run). The cap is applied after the RPC, so it bounds
// what reaches the client, not what the database reads — fine at beta scale.
// The rows are put in match order first (orderSearchMatches): the live body's
// ORDER BY isn't in the repo, and a cap over an arbitrary order could cut the
// exact handle someone typed in full.
export async function searchUsers(
  query: string
): Promise<{ results: UserSearchResult[] } | { error: string }> {
  // Anyone can POST an action directly; a non-string must not throw.
  if (typeof query !== "string") return { results: [] };
  const q = normalizeSearchQuery(query);
  if (q.length < SEARCH_QUERY_MIN) return { results: [] };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("search_users", { q });
  if (error) return { error: "Couldn't search right now." };

  // avatar_path is optional in the row type so search keeps working until the
  // user's search_users RPC is updated to return it (dashboard-side change).
  const rows = (data ?? []) as {
    id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_path?: string | null;
  }[];
  return {
    results: orderSearchMatches(rows, q)
      .slice(0, SEARCH_RESULTS_MAX)
      .map((r) => ({
        userId: r.id,
        username: r.username,
        displayName: r.display_name,
        bio: r.bio,
        avatarUrl: avatarPublicUrl(r.avatar_path ?? null),
      })),
  };
}
