import "server-only";

import { listFriends } from "@/lib/db/friends";
import { createClient } from "@/lib/supabase/server";

import type { HabitCheckoffItem } from "@/lib/db/feed";

type CompletionRow = {
  id: string;
  user_id: string;
  habit_id: string;
  posted_at: string;
};

type HabitRow = { id: string; name: string; color: string | null };

// Friends' habit check-offs for the Home feed, newest first.
//
// Only rows with a non-null `posted_at` are eligible — that column is set by
// toggleHabitCompletion exclusively for same-day check-offs, so backfilling a
// missed day never reaches anyone's feed.
//
// Reads are RLS-gated the same way sessions are (owner OR are_friends AND the
// habit is not private), so private habits never arrive here and the app does
// not re-filter. Batched over all friend ids in one query; an empty friend set
// short-circuits so we never issue an empty .in().
export async function listFriendHabitCheckoffs(
  daysBack = 7
): Promise<HabitCheckoffItem[]> {
  const friends = await listFriends();
  if (friends.length === 0) return [];

  const authorById = new Map(friends.map((f) => [f.user.userId, f.user]));
  const friendIds = friends.map((f) => f.user.userId);

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data } = await supabase
    .from("habit_completions")
    .select("id, user_id, habit_id, posted_at")
    .in("user_id", friendIds)
    .not("posted_at", "is", null)
    .gte("posted_at", since.toISOString())
    .order("posted_at", { ascending: false });
  if (!data) return [];

  const rows = data as CompletionRow[];
  const habitIds = [...new Set(rows.map((r) => r.habit_id))];
  const habitById = await hydrateHabits(habitIds);

  return rows.flatMap((row) => {
    const author = authorById.get(row.user_id);
    // A habit that didn't resolve is one we're not allowed to name — private,
    // or deleted between the two reads. Dropping the card is the correct
    // outcome either way: there is no safe stand-in for a habit's name.
    const habit = habitById.get(row.habit_id);
    if (!author || !habit) return [];
    return [
      {
        kind: "habit" as const,
        id: row.id,
        author,
        habitName: habit.name,
        habitColor: habit.color,
        postedAt: new Date(row.posted_at).getTime(),
      },
    ];
  });
}

// Batch-resolve habit id → name + colour. RLS gates the read, so a private
// habit simply doesn't come back and its check-off gets dropped above.
async function hydrateHabits(
  habitIds: string[]
): Promise<Map<string, HabitRow>> {
  const map = new Map<string, HabitRow>();
  if (habitIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("habits")
    .select("id, name, color")
    .in("id", habitIds);
  if (!data) return map;

  for (const row of data as HabitRow[]) map.set(row.id, row);
  return map;
}
