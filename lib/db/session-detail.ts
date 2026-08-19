import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { hydrateUsers, type PublicUser } from "@/lib/db/friends";
import {
  hydrateCategoryNames,
  hydrateGoals,
  resolveFeedAttribution,
  type FeedAttribution,
} from "@/lib/db/feed";
import { getSessionPhotoUrl } from "@/lib/db/session-photos";
import { SESSION_COLUMNS, rowToSession, type SessionRow } from "@/lib/db/sessions";
import { sessionWorkedMs } from "@/lib/session";

export type SessionDetail = {
  sessionId: string;
  author: PublicUser;
  isOwn: boolean;
  // What they typed they were working on — the post's headline, same field the
  // feed card leads with.
  title: string;
  // What it counts towards, resolved by the SHARED rule (goal → category →
  // null, with a private goal yielding null rather than falling through). The
  // detail page used to hand-roll "goal title else task name", which had no
  // category branch at all, so a category-tracked session showed nothing about
  // what it was filed under.
  attribution: FeedAttribution | null;
  description: string | null;
  workedMs: number;
  startedAt: number;
  endedAt: number | null;
  photoUrl: string | null;
  // Owner-only in practice: RLS never surfaces a friend's private session, so
  // this is true only on your own drafts, where the post shows a Private chip
  // instead of a like control — nobody else can see it to like it.
  isPrivate: boolean;
};

type DetailRow = SessionRow & { user_id: string };

// A single session composed for the detail page. Visibility is enforced by RLS
// on the sessions read (owner OR are_friends AND NOT is_private), so an invisible
// session simply returns null → the caller 404s and a block/private session stays
// invisible. No schema change: this only composes existing reads.
export async function getSessionForViewer(
  sessionId: string
): Promise<SessionDetail | null> {
  const me = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("sessions")
    .select(`${SESSION_COLUMNS}, user_id`)
    .eq("id", sessionId)
    .maybeSingle();
  if (!data) return null;

  const row = data as DetailRow;
  const session = rowToSession(row);

  const [authors, goalById, categoryById, photoUrl] = await Promise.all([
    hydrateUsers([row.user_id]),
    hydrateGoals(row.goal_id ? [row.goal_id] : []),
    hydrateCategoryNames(row.category_id ? [row.category_id] : []),
    getSessionPhotoUrl(session),
  ]);

  const author = authors.get(row.user_id);
  if (!author) return null;

  return {
    sessionId: session.id,
    author,
    isOwn: me != null && me.id === row.user_id,
    title: session.taskName.trim() || "Untitled session",
    attribution: resolveFeedAttribution(row, goalById, categoryById),
    description: session.description?.trim() || null,
    workedMs: sessionWorkedMs(session, Date.now()),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    photoUrl,
    isPrivate: session.isPrivate,
  };
}
