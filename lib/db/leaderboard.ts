import "server-only";

import { cache } from "react";

import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export type LeaderboardRow = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  trackedMs: number;
  rank: number;
  isMe: boolean;
};

type RpcRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  // PostgREST returns bigint as a string.
  tracked_ms: number | string;
  rank: number;
  is_me: boolean;
};

// The circle leaderboard for a week: the caller + their accepted friends, ranked
// by clocked focus time, computed by the `week_leaderboard` SECURITY DEFINER RPC.
// The RPC takes only the week bounds and derives the circle from auth.uid() + the
// friendships table — there is no user-id parameter, so a caller can never rank
// against anyone outside their own accepted friends. Ranks CLOCKED SESSIONS ONLY:
// imported calendar events are deliberately excluded (a packed calendar shouldn't
// win). The session math mirrors sessionWorkedMs exactly (span − banked pause −
// in-progress pause, floored, now capped at week end), so this is a distinct
// metric from computeWeekRecap's totalTrackedMs (which also counts events) — by
// design. A friend's private sessions count only for the owner, matching the
// feed's are_friends+NOT-private visibility. Cached per request, keyed on window.
export const getWeekLeaderboard = cache(
  async (weekStartMs: number, weekEndMs: number): Promise<LeaderboardRow[]> => {
    const me = await getCurrentUser();
    if (!me) return [];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("week_leaderboard", {
      p_week_start_ms: weekStartMs,
      p_week_end_ms: weekEndMs,
    });
    if (error || !data) return [];

    return (data as RpcRow[]).map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: avatarPublicUrl(r.avatar_path),
      trackedMs: Number(r.tracked_ms),
      rank: r.rank,
      isMe: r.is_me,
    }));
  }
);
