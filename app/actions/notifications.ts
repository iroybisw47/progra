"use server";

import { getNavBadges, type NavBadges } from "@/lib/db/notifications";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

// Poll endpoint for the bottom nav's Feed/Friends dots.
export async function fetchNavBadges(): Promise<NavBadges> {
  return getNavBadges();
}

// Stamp the feed tab as seen (clears its dot). No revalidation — the nav owns
// its own dot state and reconciles from fetchNavBadges. Never throws.
export async function markFeedSeen(): Promise<{ ok: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ feed_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function markFriendsSeen(): Promise<
  { ok: true } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ friend_requests_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}
