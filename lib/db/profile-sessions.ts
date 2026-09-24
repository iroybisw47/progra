import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import {
  hydrateCategoryNames,
  hydrateGoals,
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

// Newest-first cap on the RENDERED list. Raised from 50 once real profiles
// outgrew it. Signing is one batched createSignedUrls call regardless of count,
// so the cost of a bigger number is payload size, not round trips — but the
// page is still server-rendered in one go, so it isn't unbounded either. Add
// "load more" if this is ever outgrown in turn.
//
// The profile's session COUNT must never be derived from this list — use
// countProfileSessions below, or a heavy user's profile reports exactly this
// number forever.
const DEFAULT_LIMIT = 200;

// A user's finished sessions for their profile, newest first. RLS does the
// filtering (owner → all, including private; accepted friend → non-private;
// stranger/blocked → none), so this deliberately does NOT re-filter on
// is_private — doing so would hide your own private sessions from your own
// profile.
// How many finished sessions this profile actually has, independent of the
// render cap above.
//
// THE BUG THIS FIXES: the profile's "Sessions" stat and the Recent-sessions
// header both counted the array returned by listProfileSessions, which is
// capped — so anyone past the cap showed exactly that number and it never moved
// again. head+exact does the count in the database, and the same RLS applies,
// so a viewer is counted exactly the sessions they are allowed to see.
// Total worked time across every finished session a viewer may see, for the
// profile's "Hours" stat.
//
// Summed here rather than in SQL on purpose: sessionWorkedMs is the one
// definition of worked time (banked pauses excluded, auto-ended sessions worth
// ZERO, ended rows read back exactly as stored). A sum() in Postgres would be a
// second implementation of that rule and would silently disagree with the
// leaderboard, recaps and rollups the moment either side changed — which is the
// same trap week_leaderboard already documents.
//
// Only four narrow columns, and no render cap: this is a total, so capping it
// would repeat the bug countProfileSessions exists to fix. RLS scopes the rows
// (owner → all incl. private; accepted friend → non-private), so a friend's
// total is legitimately smaller than the owner's own.
export async function sumProfileTrackedMs(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("started_at, ended_at, paused_ms, auto_ended_at")
    .eq("user_id", userId)
    .not("ended_at", "is", null);
  if (!data) return 0;

  const now = Date.now();
  let total = 0;
  for (const row of data as {
    started_at: string;
    ended_at: string | null;
    paused_ms: number | null;
    auto_ended_at: string | null;
  }[]) {
    total += sessionWorkedMs(
      {
        startedAt: Date.parse(row.started_at),
        endedAt: row.ended_at === null ? null : Date.parse(row.ended_at),
        pausedMs: row.paused_ms ?? 0,
        pausedSince: null,
        autoEndedAt: row.auto_ended_at === null ? null : Date.parse(row.auto_ended_at),
      },
      now
    );
  }
  return total;
}

export async function countProfileSessions(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("ended_at", "is", null);
  return count ?? 0;
}

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
  const [goalById, categoryNameById, photoUrlByPath] = await Promise.all([
    hydrateGoals(goalIds),
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
        attribution: resolveFeedAttribution(row, goalById, categoryNameById),
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
