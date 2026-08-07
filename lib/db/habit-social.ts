import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { LIKE_EMOJI } from "@/lib/social/reactions";

// Kudos summary for one habit check-off (only LIKE_EMOJI is surfaced, matching
// the feed's single-heart model). Same shape as RecapKudos.
export type HabitKudos = { count: number; mine: boolean };

type HabitReactionRow = {
  completion_id: string;
  user_id: string;
  emoji: string;
};

// Batch-load kudos for a set of habit check-offs, grouped by completion id.
// RLS returns only reactions on check-offs the viewer can see, so nothing here
// needs re-filtering. Parallel to listRecapKudos / listReactionsForSessions.
export async function listHabitKudos(
  completionIds: string[]
): Promise<Map<string, HabitKudos>> {
  const out = new Map<string, HabitKudos>();
  if (completionIds.length === 0) return out;

  const me = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_completion_reactions")
    .select("completion_id, user_id, emoji")
    .in("completion_id", completionIds)
    .eq("emoji", LIKE_EMOJI);
  if (!data) return out;

  for (const row of data as HabitReactionRow[]) {
    const cur = out.get(row.completion_id) ?? { count: 0, mine: false };
    cur.count += 1;
    if (me && row.user_id === me.id) cur.mine = true;
    out.set(row.completion_id, cur);
  }
  return out;
}
