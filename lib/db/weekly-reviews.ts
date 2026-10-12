import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { hydrateUsers, type PublicUser } from "@/lib/db/friends";
import type { RecapCategorySlice, RecapFeedItem } from "@/lib/db/feed";
import { RECAP_V2 } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Posted weekly reviews (recap_posts) outside the feed: a person's own list on
// You, a friend's on their profile, one post on /review/[id]. All RLS-gated
// (owner or accepted friend); nothing here filters by hand for security.

export const RECAP_POST_COLUMNS =
  "id, user_id, week_start_ms, caption, total_tracked_ms, rank, circle_size, categories, created_at";
// The weekly review's columns (.claude/plans/recap-v2.sql STEP 1).
export const REVIEW_POST_COLUMNS = `${RECAP_POST_COLUMNS}, goal_pct, goal_count, habit_pct, habit_count`;

export type RecapPostRow = {
  id: string;
  user_id: string;
  week_start_ms: number | string;
  caption: string | null;
  total_tracked_ms: number | string;
  rank: number | null;
  circle_size: number;
  categories: RecapCategorySlice[] | null;
  created_at: string;
  goal_pct?: number | null;
  goal_count?: number | null;
  habit_pct?: number | null;
  habit_count?: number | null;
};

export function rowToRecapItem(row: RecapPostRow, author: PublicUser): RecapFeedItem {
  return {
    kind: "recap",
    id: row.id,
    author,
    weekStartMs: Number(row.week_start_ms),
    caption: row.caption,
    totalTrackedMs: Number(row.total_tracked_ms),
    rank: row.rank,
    circleSize: row.circle_size,
    categories: row.categories ?? [],
    postedAt: new Date(row.created_at).getTime(),
    goalPct: row.goal_pct ?? null,
    goalCount: row.goal_count ?? null,
    habitPct: row.habit_pct ?? null,
    habitCount: row.habit_count ?? null,
  };
}

type Selected = { data: unknown; error: { code?: string } | null };

// Reads the weekly review's columns when RECAP_V2 is on, and falls back to the
// old ones if they don't exist yet (42703: the SQL hasn't run) — a post then
// shows hours only rather than the read failing.
export async function selectRecapPosts(
  run: (columns: string) => PromiseLike<Selected>
): Promise<RecapPostRow[]> {
  if (RECAP_V2) {
    const r = await run(REVIEW_POST_COLUMNS);
    if (!r.error) return (r.data ?? []) as RecapPostRow[];
    if (r.error.code !== "42703") return [];
  }
  const r = await run(RECAP_POST_COLUMNS);
  return r.error ? [] : ((r.data ?? []) as RecapPostRow[]);
}

// One person's posted reviews, newest week first (You, and a friend's profile).
export const listRecapPostsForUser = cache(
  async (userId: string, limit = 8): Promise<RecapFeedItem[]> => {
    if (!isUuid(userId)) return [];
    const supabase = await createClient();
    const rows = await selectRecapPosts((cols) =>
      supabase
        .from("recap_posts")
        .select(cols)
        .eq("user_id", userId)
        .order("week_start_ms", { ascending: false })
        .limit(limit)
    );
    if (rows.length === 0) return [];
    const author = (await hydrateUsers([userId])).get(userId);
    return author ? rows.map((r) => rowToRecapItem(r, author)) : [];
  }
);

// One post (/review/[id]), or null when it doesn't exist or isn't visible.
export const getRecapPost = cache(
  async (id: string): Promise<(RecapFeedItem & { isOwn: boolean }) | null> => {
    if (!isUuid(id)) return null;
    const [me, supabase] = await Promise.all([getCurrentUser(), createClient()]);
    const [row] = await selectRecapPosts((cols) =>
      supabase.from("recap_posts").select(cols).eq("id", id).limit(1)
    );
    if (!row) return null;
    const author = (await hydrateUsers([row.user_id])).get(row.user_id);
    if (!author) return null;
    return { ...rowToRecapItem(row, author), isOwn: !!me && me.id === row.user_id };
  }
);

// This week's post by me, if any — what the Share slide opens on. Only columns
// that predate the weekly review, so it can't fail before the SQL has run.
export const getMyRecapPostForWeek = cache(
  async (weekStartMs: number): Promise<{ id: string; caption: string | null } | null> => {
    const me = await getCurrentUser();
    if (!me) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("recap_posts")
      .select("id, caption")
      .eq("user_id", me.id)
      .eq("week_start_ms", weekStartMs)
      .maybeSingle();
    return (data as { id: string; caption: string | null } | null) ?? null;
  }
);
