import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import { hydrateGoalTitles } from "@/lib/db/feed";
import { getSessionPhotoUrls } from "@/lib/db/session-photos";
import { sessionWorkedMs } from "@/lib/session";

// A profile "story": a finished session that has BOTH a before and after photo.
// This is the only session shape that surfaces on a profile (the complete pair
// IS the share action). Photo-less / half-complete sessions stay private.
export type StoryItem = {
  sessionId: string;
  label: string;
  isGoal: boolean;
  workedMs: number;
  endedAt: number;
  beforeUrl: string;
  afterUrl: string;
};

// Complete-pair sessions for a user, newest-finished first. RLS filters out
// private / non-friend rows (and the storage policy backs the signed URLs), so
// a viewer only ever gets non-private complete pairs they're allowed to see.
export async function listProfileStories(
  userId: string,
  limit = 20
): Promise<StoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .not("before_photo_path", "is", null)
    .not("after_photo_path", "is", null)
    .order("ended_at", { ascending: false })
    .limit(limit);
  if (!data) return [];

  const rows = data as SessionRow[];
  const goalIds = [
    ...new Set(
      rows.map((r) => r.goal_id).filter((g): g is string => g != null)
    ),
  ];
  const goalTitleById = await hydrateGoalTitles(goalIds);
  const now = Date.now();

  const items = await Promise.all(
    rows.map(async (row) => {
      const session = rowToSession(row);
      if (session.endedAt == null) return null;
      const urls = await getSessionPhotoUrls(session);
      // Defensive: skip if either signed URL failed (e.g. storage denied it).
      if (!urls.before || !urls.after) return null;
      const goalTitle = row.goal_id
        ? goalTitleById.get(row.goal_id)
        : undefined;
      const label = goalTitle ?? (session.taskName.trim() || "Untitled session");
      return {
        sessionId: session.id,
        label,
        isGoal: goalTitle != null,
        workedMs: sessionWorkedMs(session, now),
        endedAt: session.endedAt,
        beforeUrl: urls.before,
        afterUrl: urls.after,
      } satisfies StoryItem;
    })
  );

  return items.filter((i): i is StoryItem => i !== null);
}
