import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import {
  hydrateCategoryNames,
  hydrateGoalTitles,
  resolveFeedAttribution,
  type SessionCardItem,
} from "@/lib/db/feed";
import { hydrateSessionPhotoUrls } from "@/lib/db/session-photos";
import { sessionWorkedMs } from "@/lib/session";

// One finished session on a profile. A photo is an optional attachment, not a
// requirement: a session shows here on the strength of being visible to us at
// all, which is what `is_private` + RLS already decide.
//
// This is the SAME shape the feed produces, so <SessionCard> renders profiles
// and the feed identically. It used to be a narrower type (a single collapsed
// `label`, no title/description/category/privacy) which is exactly how the
// profile card drifted into showing less than the feed's.
export type ProfileSessionItem = SessionCardItem;

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
  // Category ids too: without these a category-tracked session resolved to no
  // attribution at all on profiles (only goals were hydrated), which is why the
  // category name and its color dot were missing from the card.
  const categoryIds = [
    ...new Set(
      rows.map((r) => r.category_id).filter((c): c is string => c != null)
    ),
  ];
  const [goalTitleById, categoryNameById, photoUrlByPath] = await Promise.all([
    hydrateGoalTitles(goalIds),
    hydrateCategoryNames(categoryIds),
    hydrateSessionPhotoUrls(photoPaths),
  ]);
  const now = Date.now();

  return rows.flatMap((row) => {
    const session = rowToSession(row);
    if (session.endedAt == null) return [];
    return [
      {
        sessionId: session.id,
        title: session.taskName.trim() || "Untitled session",
        // Shared with the feed so the private-goal rule (a hidden goal yields
        // no chip rather than falling through to a category) holds identically.
        attribution: resolveFeedAttribution(row, goalTitleById, categoryNameById),
        description: session.description?.trim() || null,
        workedMs: sessionWorkedMs(session, now),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        photoUrl: session.photoPath
          ? (photoUrlByPath.get(session.photoPath) ?? null)
          : null,
        // Own profile only — RLS strips other people's private sessions before
        // they reach here. Drives the card's Private chip.
        isPrivate: session.isPrivate,
      },
    ];
  });
}
