import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/social/username";
import type { PublicUser } from "@/lib/db/friends";

export type RelationshipKind =
  | "self"
  | "friends"
  | "incoming"
  | "outgoing"
  | "none";

export type Relationship = {
  kind: RelationshipKind;
  friendshipId?: string;
  requestId?: string;
};

// Resolve a handle to its public identity via the narrow public_profiles view
// (only id/username/display_name/bio — never token columns). Null if no such
// handle. Any authenticated user may resolve any handle (public identity is
// public by design); the sensitive data stays gated by the tables' own RLS.
export async function getPublicProfileByUsername(
  username: string
): Promise<PublicUser | null> {
  const handle = normalizeUsername(username);
  if (!handle) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, bio, avatar_path")
    .eq("username", handle)
    .maybeSingle();
  if (!data) return null;

  const row = data as {
    id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_path: string | null;
  };
  return {
    userId: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: avatarPublicUrl(row.avatar_path),
  };
}

// The viewer's relationship to a target user, for the profile's action button.
// Block rows are hidden from the blocked party by RLS and are handled by the
// are_blocked() 404 on the profile page — so they never surface here.
export async function getRelationship(
  targetUserId: string
): Promise<Relationship> {
  const me = await getCurrentUser();
  if (!me) return { kind: "none" };
  if (me.id === targetUserId) return { kind: "self" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${me.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${me.id})`
    )
    .maybeSingle();
  if (!data) return { kind: "none" };

  const row = data as {
    id: string;
    requester_id: string;
    addressee_id: string;
    status: string;
  };
  if (row.status === "accepted") {
    return { kind: "friends", friendshipId: row.id };
  }
  if (row.status === "pending") {
    return row.addressee_id === me.id
      ? { kind: "incoming", requestId: row.id }
      : { kind: "outgoing", requestId: row.id };
  }
  return { kind: "none" };
}
