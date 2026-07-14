import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { hydrateUsers, type PublicUser } from "@/lib/db/friends";

export type CommentItem = {
  id: string;
  author: PublicUser;
  body: string;
  createdAt: number;
  // Whether the current viewer may delete this comment. True for your own
  // comments. (Session-owner moderation is also permitted by RLS, but the feed
  // only shows friends' sessions today, so that affordance surfaces later.)
  canDelete: boolean;
};

type CommentRow = {
  id: string;
  session_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

// Batch-load comments for a set of feed sessions, grouped by session id, oldest
// first within each session. RLS returns only comments on sessions the viewer
// can see, so nothing here needs re-filtering. Authors are resolved through the
// narrow public_profiles view via hydrateUsers.
export async function listCommentsForSessions(
  sessionIds: string[]
): Promise<Map<string, CommentItem[]>> {
  const grouped = new Map<string, CommentItem[]>();
  if (sessionIds.length === 0) return grouped;

  const me = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_comments")
    .select("id, session_id, author_id, body, created_at")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (!data) return grouped;

  const rows = data as CommentRow[];
  const authors = await hydrateUsers([...new Set(rows.map((r) => r.author_id))]);

  for (const row of rows) {
    const author = authors.get(row.author_id);
    if (!author) continue;
    const list = grouped.get(row.session_id) ?? [];
    list.push({
      id: row.id,
      author,
      body: row.body,
      createdAt: new Date(row.created_at).getTime(),
      canDelete: me != null && row.author_id === me.id,
    });
    grouped.set(row.session_id, list);
  }
  return grouped;
}
