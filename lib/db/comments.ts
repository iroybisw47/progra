import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { COMMENT_REPLIES } from "@/lib/flags";
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
  // Threading (COMMENT_REPLIES). Both null on a top-level comment — and on
  // every comment while the flag is off. parentId is always the thread's ROOT
  // (the thread-guard trigger sets it), so one level is all there is.
  parentId: string | null;
  replyToId: string | null;
  // Who a reply was aimed at. Survives the replied-to comment being deleted.
  replyTo: PublicUser | null;
};

type CommentRow = {
  id: string;
  session_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_id?: string | null;
  reply_to_id?: string | null;
  reply_to_author_id?: string | null;
};

const COMMENT_COLUMNS = "id, session_id, author_id, body, created_at";
const THREAD_COLUMNS = `${COMMENT_COLUMNS}, parent_id, reply_to_id, reply_to_author_id`;

// Batch-load comments for a set of feed sessions, grouped by session id, oldest
// first within each session. RLS returns only comments on sessions the viewer
// can see, so nothing here needs re-filtering. Authors are resolved through the
// narrow public_profiles view via hydrateUsers.
//
// The thread columns are only selected with the flag on — and if that select
// fails (the hand-run SQL not applied yet), it falls back to the flat columns
// rather than returning nothing: an empty result here means every comment on
// the page silently disappears.
export async function listCommentsForSessions(
  sessionIds: string[]
): Promise<Map<string, CommentItem[]>> {
  const grouped = new Map<string, CommentItem[]>();
  if (sessionIds.length === 0) return grouped;

  const me = await getCurrentUser();
  const supabase = await createClient();
  const select = (columns: string) =>
    supabase
      .from("session_comments")
      .select(columns)
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

  let { data, error } = await select(COMMENT_REPLIES ? THREAD_COLUMNS : COMMENT_COLUMNS);
  if (error && COMMENT_REPLIES) ({ data, error } = await select(COMMENT_COLUMNS));
  if (error || !data) return grouped;

  const rows = data as unknown as CommentRow[];
  const people = await hydrateUsers([
    ...new Set(
      rows.flatMap((r) =>
        r.reply_to_author_id ? [r.author_id, r.reply_to_author_id] : [r.author_id]
      )
    ),
  ]);

  for (const row of rows) {
    const author = people.get(row.author_id);
    if (!author) continue;
    const list = grouped.get(row.session_id) ?? [];
    list.push({
      id: row.id,
      author,
      body: row.body,
      createdAt: new Date(row.created_at).getTime(),
      canDelete: me != null && row.author_id === me.id,
      parentId: row.parent_id ?? null,
      replyToId: row.reply_to_id ?? null,
      replyTo: row.reply_to_author_id ? (people.get(row.reply_to_author_id) ?? null) : null,
    });
    grouped.set(row.session_id, list);
  }
  return grouped;
}
