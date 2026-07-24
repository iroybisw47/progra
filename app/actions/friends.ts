"use server";

import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { revalidateFriendSurfaces } from "@/lib/revalidate";
import { normalizeUsername } from "@/lib/social/username";
import { isUuid } from "@/lib/validate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

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
// deliberately generic so a hidden block never reveals itself.
export async function sendFriendRequest(targetUserId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!targetUserId || targetUserId === user.id) {
    return { error: "Couldn't send request." };
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    addressee_id: targetUserId,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") return { error: "Couldn't send request." };
    return { error: error.message };
  }
  revalidateFriendSurfaces();
  return { ok: true };
}

// Accept an incoming request. Routed through the definer RPC so the DB — not
// app code — enforces that only the addressee of a pending request can accept
// (a requester must not be able to fabricate a friendship via the raw API).
export async function acceptFriendRequest(requestId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("accept_friend_request", {
    request_id: requestId,
  });
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
  revalidateFriendSurfaces();
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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
  revalidateFriendSurfaces();
  return { ok: true };
}

// Prefix search over public handles/display names. Definer RPC excludes self
// and anyone in a block relationship with me (either direction), so blocks stay
// invisible during discovery. Returns [] for very short queries.
export async function searchUsers(
  query: string
): Promise<{ results: UserSearchResult[] } | { error: string }> {
  const q = normalizeUsername(query);
  if (q.length < 2) return { results: [] };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("search_users", { q });
  if (error) return { error: error.message };

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
    results: rows.map((r) => ({
      userId: r.id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio,
      avatarUrl: avatarPublicUrl(r.avatar_path ?? null),
    })),
  };
}
