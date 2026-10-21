import "server-only";

import { cache } from "react";

import { STREAKS } from "@/lib/flags";
import { STREAK_LAUNCH_DATE } from "@/lib/streaks-config";
import {
  rowToFriendStreak,
  rowToMyStreak,
  type FriendStreak,
  type MyStreak,
} from "@/lib/streaks-view";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Streak reads (.claude/plans/streaks.md). Both are RPCs, because the rules
// live in the database (streaks.sql): the server decides the day, a settled
// day is final, and a friend's number is computed where their private rows
// can be left out rather than read and filtered here.
//
// Null means "show nothing": the flag is off, the SQL hasn't run, the database
// kill switch (streak_config.enabled) is off, or the call failed.

let warnedLaunch = false;

// The database's launch date is the one counting uses. The TS constant only
// words the copy, so a mismatch is logged, once, and the database wins.
function checkLaunch(launch: string | null) {
  if (warnedLaunch || launch === STREAK_LAUNCH_DATE) return;
  warnedLaunch = true;
  console.error(
    `streaks: streak_config.launch_date (${launch}) != STREAK_LAUNCH_DATE (${STREAK_LAUNCH_DATE}); change them together`
  );
}

export const getMyStreak = cache(async (): Promise<MyStreak | null> => {
  if (!STREAKS) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_streak");
  if (error) return null;
  const streak = rowToMyStreak(data);
  if (streak) checkLaunch(streak.launch);
  return streak;
});

// A friend's streak over their shared activity only. The RPC returns null
// unless the caller and `userId` are accepted friends and not blocked, so a
// stranger can't learn anything by calling it.
export const getFriendStreak = cache(
  async (userId: string): Promise<FriendStreak | null> => {
    if (!STREAKS || !isUuid(userId)) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_friend_streak", {
      p_user: userId,
    });
    if (error) return null;
    return rowToFriendStreak(data);
  }
);
