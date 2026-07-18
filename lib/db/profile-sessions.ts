import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import { hydrateGoalTitles } from "@/lib/db/feed";
import { hydrateSessionPhotoUrls } from "@/lib/db/session-photos";
import { sessionWorkedMs } from "@/lib/session";

// One finished session on a profile. A photo is an optional attachment, not a
// requirement: a session shows here on the strength of being visible to us at
// all, which is what `is_private` + RLS already decide.
export type ProfileSessionItem = {
  sessionId: string;
  label: string;
  isGoal: boolean;
  workedMs: number;
  endedAt: number;
  photoUrl: string | null;
};

// Newest-first cap. The profile shows a session history rather than a curated
// gallery, so this is the only thing bounding the read — raise it or add
// pagination if a profile ever outgrows one screenful of scrolling.
const DEFAULT_LIMIT = 50;

// A user's finished sessions for their profile, newest first. RLS does the
// filtering (owner → all, including private; accepted friend → non-private;
// stranger/blocked → none), so this deliberately does NOT re-filter on
// is_private — doing so would hide your own private sessions from your own
// profile.
export async function listProfileSessions(
  userId: string,
  limit = DEFAULT_LIMIT
): Promise<ProfileSessionItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(limit);
  if (!data) return [];

  const rows = data as SessionRow[];
  const goalIds = [
    ...new Set(
      rows.map((r) => r.goal_id).filter((g): g is string => g != null)
    ),
  ];
  // Both batched: one goal-title read and one signing call for the whole list.
  // Signing per row would cost a round trip per card now that every session
  // lists, not just the handful that had a complete photo pair.
  const photoPaths = [
    ...new Set(
      rows.map((r) => r.photo_path).filter((p): p is string => p != null)
    ),
  ];
  const [goalTitleById, photoUrlByPath] = await Promise.all([
    hydrateGoalTitles(goalIds),
    hydrateSessionPhotoUrls(photoPaths),
  ]);
  const now = Date.now();

  return rows.flatMap((row) => {
    const session = rowToSession(row);
    if (session.endedAt == null) return [];
    const goalTitle = row.goal_id ? goalTitleById.get(row.goal_id) : undefined;
    return [
      {
        sessionId: session.id,
        label: goalTitle ?? (session.taskName.trim() || "Untitled session"),
        isGoal: goalTitle != null,
        workedMs: sessionWorkedMs(session, now),
        endedAt: session.endedAt,
        photoUrl: session.photoPath
          ? (photoUrlByPath.get(session.photoPath) ?? null)
          : null,
      },
    ];
  });
}
