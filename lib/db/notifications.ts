import "server-only";

import { cache } from "react";

import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import { listFriends } from "@/lib/db/friends";
import { createClient } from "@/lib/supabase/server";

export type NavBadges = { feed: boolean; friends: boolean };

// Match the feed's window (listFriendFeed/listFriendJoins use 7 days) so a Feed
// dot never points at content the feed itself wouldn't show.
const FEED_WINDOW_DAYS = 7;

function ms(ts: string | null | undefined): number {
  return ts ? new Date(ts).getTime() : 0;
}

// Whether the Feed / Friends nav tabs should show a "new since you last looked"
// dot. Timestamp-only reads (no row hydration); RLS scopes visibility, so we
// only ever compare against activity the user is allowed to see. Cached per
// request (shared by the layout seed and the poll action).
export const getNavBadges = cache(async (): Promise<NavBadges> => {
  const user = await getCurrentUser();
  if (!user) return { feed: false, friends: false };

  const [profile, friends] = await Promise.all([getProfile(), listFriends()]);
  const feedSeen = ms(profile?.feed_seen_at);
  const reqSeen = ms(profile?.friend_requests_seen_at);
  const friendIds = friends.map((f) => f.user.userId);

  const supabase = await createClient();
  const sinceIso = new Date(
    Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const [latestSession, latestJoin, latestRequest] = await Promise.all([
    // Newest finished friend session in-window.
    friendIds.length === 0
      ? Promise.resolve(null)
      : supabase
          .from("sessions")
          .select("ended_at")
          .in("user_id", friendIds)
          .not("ended_at", "is", null)
          .gte("ended_at", sinceIso)
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => (r.data as { ended_at: string } | null)?.ended_at ?? null),
    // Newest friend who joined in-window (feed shows a "just joined" item).
    friendIds.length === 0
      ? Promise.resolve(null)
      : supabase
          .from("public_profiles")
          .select("onboarded_at")
          .in("id", friendIds)
          .gte("onboarded_at", sinceIso)
          .order("onboarded_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(
            (r) => (r.data as { onboarded_at: string } | null)?.onboarded_at ?? null
          ),
    // Newest pending incoming friend request.
    supabase
      .from("friendships")
      .select("created_at")
      .eq("status", "pending")
      .eq("addressee_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => (r.data as { created_at: string } | null)?.created_at ?? null),
  ]);

  const latestFeed = Math.max(ms(latestSession), ms(latestJoin));
  return {
    feed: latestFeed > feedSeen,
    friends: ms(latestRequest) > reqSeen,
  };
});
