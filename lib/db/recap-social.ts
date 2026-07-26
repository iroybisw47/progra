import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { hydrateUsers, type PublicUser } from "@/lib/db/friends";
import { LIKE_EMOJI } from "@/lib/social/reactions";

// Kudos summary for one recap post (only the LIKE_EMOJI is surfaced, matching
// the feed's single-heart model).
export type RecapKudos = { count: number; mine: boolean };

export type RecapComment = {
  id: string;
  author: PublicUser;
  body: string;
  createdAt: number;
  canDelete: boolean;
};

type RecapReactionRow = { recap_post_id: string; user_id: string; emoji: string };
type RecapCommentRow = {
  id: string;
  recap_post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

// Batch-load kudos for a set of recap posts, grouped by post id. RLS (SELECT via
// can_see_recap) returns only reactions on recaps the viewer can see, so nothing
// here needs re-filtering. Parallel to listReactionsForSessions.
export async function listRecapKudos(
  recapIds: string[]
): Promise<Map<string, RecapKudos>> {
  const out = new Map<string, RecapKudos>();
  if (recapIds.length === 0) return out;

  const me = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("recap_reactions")
    .select("recap_post_id, user_id, emoji")
    .in("recap_post_id", recapIds)
    .eq("emoji", LIKE_EMOJI);
  if (!data) return out;

  for (const row of data as RecapReactionRow[]) {
    const cur = out.get(row.recap_post_id) ?? { count: 0, mine: false };
    cur.count += 1;
    if (me && row.user_id === me.id) cur.mine = true;
    out.set(row.recap_post_id, cur);
  }
  return out;
}

// Batch-load comments for a set of recap posts, oldest-first, grouped by post id.
// Author identity resolves through the public_profiles view (hydrateUsers), same
// as every other cross-user read. `canDelete` is the author-self check (the feed
// never shows your own posts, so recap-owner deletes don't arise here — RLS still
// permits them). Parallel to listCommentsForSessions.
export async function listRecapComments(
  recapIds: string[]
): Promise<Map<string, RecapComment[]>> {
  const out = new Map<string, RecapComment[]>();
  if (recapIds.length === 0) return out;

  const me = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("recap_comments")
    .select("id, recap_post_id, author_id, body, created_at")
    .in("recap_post_id", recapIds)
    .order("created_at", { ascending: true });
  if (!data) return out;

  const rows = data as RecapCommentRow[];
  const authors = await hydrateUsers([...new Set(rows.map((r) => r.author_id))]);

  for (const row of rows) {
    const author = authors.get(row.author_id);
    if (!author) continue; // handle-less author drops cleanly
    const list = out.get(row.recap_post_id) ?? [];
    list.push({
      id: row.id,
      author,
      body: row.body,
      createdAt: new Date(row.created_at).getTime(),
      canDelete: !!me && row.author_id === me.id,
    });
    out.set(row.recap_post_id, list);
  }
  return out;
}
