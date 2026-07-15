import "server-only";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { hydrateUsers, type PublicUser } from "@/lib/db/friends";
import { hydrateGoalTitles } from "@/lib/db/feed";
import { getSessionPhotoUrls } from "@/lib/db/session-photos";
import { SESSION_COLUMNS, rowToSession, type SessionRow } from "@/lib/db/sessions";
import { sessionWorkedMs } from "@/lib/session";

export type SessionDetail = {
  sessionId: string;
  author: PublicUser;
  isOwn: boolean;
  // Goal title when goal-tracked and the goal is visible to us, else the task
  // name (private goal titles never leak — same rule as the feed).
  label: string;
  isGoal: boolean;
  description: string | null;
  workedMs: number;
  startedAt: number;
  endedAt: number | null;
  beforeUrl: string | null;
  afterUrl: string | null;
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

  const [authors, goalTitleById, photos] = await Promise.all([
    hydrateUsers([row.user_id]),
    row.goal_id ? hydrateGoalTitles([row.goal_id]) : Promise.resolve(null),
    getSessionPhotoUrls(session),
  ]);

  const author = authors.get(row.user_id);
  if (!author) return null;

  const goalTitle = goalTitleById?.get(row.goal_id as string);
  const label = goalTitle ?? (session.taskName.trim() || "Untitled session");

  return {
    sessionId: session.id,
    author,
    isOwn: me != null && me.id === row.user_id,
    label,
    isGoal: goalTitle != null,
    description: session.description?.trim() || null,
    workedMs: sessionWorkedMs(session, Date.now()),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    beforeUrl: photos.before,
    afterUrl: photos.after,
  };
}
