import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/storage";

export type SessionRow = {
  id: string;
  category_id: string | null;
  goal_id: string | null;
  task_name: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  paused_ms: number | string | null;
  paused_since: string | null;
  is_private: boolean;
  photo_path: string | null;
};

// Columns selected for every session read. Single constant so the pause
// columns can't be forgotten on a new query. Exported so cross-user readers
// (e.g. the feed) select the same shape; add ", user_id" when the reader needs
// to attribute a row to its author.
export const SESSION_COLUMNS =
  "id, category_id, goal_id, task_name, description, started_at, ended_at, paused_ms, paused_since, is_private, photo_path";

export function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    categoryId: row.category_id,
    goalId: row.goal_id,
    taskName: row.task_name,
    description: row.description ?? undefined,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
    // PostgREST returns bigint as string; normalize to number. Defaults handle
    // pre-migration rows the column was added to (0 / null).
    pausedMs: row.paused_ms != null ? Number(row.paused_ms) : 0,
    pausedSince: row.paused_since ? new Date(row.paused_since).getTime() : null,
    isPrivate: row.is_private ?? false,
    photoPath: row.photo_path ?? null,
  };
}

// Returns sessions overlapping [startMs, endMs). Overlap test: started_at <
// endMs AND (ended_at > startMs OR ended_at IS NULL). Used by the recap to
// fetch arbitrary historical weeks — listRecentSessions caps at ~14 days.
// Cached per request, keyed on the numeric window.
export const listSessionsInRange = cache(async (
  startMs: number,
  endMs: number
): Promise<Session[]> => {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const { data } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", me.id)
    .lt("started_at", endIso)
    .or(`ended_at.gt.${startIso},ended_at.is.null`)
    .order("started_at", { ascending: false });
  if (!data) return [];
  return (data as SessionRow[]).map(rowToSession);
});

// The single active (not-yet-ended) session for the current user, or null. Lean
// read used by the root layout to drive the nav's live-ticking center button
// (V2). At most one active session exists per user (partial unique index), so
// maybeSingle is safe. Cached per request — the layout and the clock surfaces
// share one round-trip.
export const getActiveSession = cache(async (): Promise<Session | null> => {
  const me = await getCurrentUser();
  if (!me) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", me.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToSession(data as SessionRow) : null;
});

// Returns sessions started within the last `daysBack` days OR any still-active
// session regardless of start time. The clock page only renders the current
// week, so 14 days is plenty (covers Monday-week start when today is Sunday
// plus a tz-safety buffer); active sessions are returned via the OR clause
// even if they started earlier.
export async function listRecentSessions(daysBack = 14): Promise<Session[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", me.id)
    .or(`started_at.gte.${since.toISOString()},ended_at.is.null`)
    .order("started_at", { ascending: false });

  if (!data) return [];
  return (data as SessionRow[]).map(rowToSession);
}

// One page of past (completed) sessions for the history surface, newest first.
// `categoryId` null = all categories; `"none"` = the Uncategorized bucket.
// Cursor pagination by started_at: pass the oldest `startedAt` from the prior
// page as `beforeMs` to fetch the next page. Only ended sessions are returned —
// the active/paused session lives on the clock page, not in history.
export const SESSION_HISTORY_PAGE_SIZE = 50;

export async function listSessionHistory(opts: {
  categoryId?: string | "none" | null;
  beforeMs?: number | null;
  limit?: number;
}): Promise<Session[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const limit = opts.limit ?? SESSION_HISTORY_PAGE_SIZE;

  let query = supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", me.id)
    .not("ended_at", "is", null);

  if (opts.categoryId === "none") {
    query = query.is("category_id", null);
  } else if (opts.categoryId) {
    query = query.eq("category_id", opts.categoryId);
  }
  if (opts.beforeMs != null) {
    query = query.lt("started_at", new Date(opts.beforeMs).toISOString());
  }

  const { data } = await query
    .order("started_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return (data as SessionRow[]).map(rowToSession);
}

// Cross-user read (social v2 profile pages): another user's recent sessions.
// No owner guard — RLS decides visibility (owner → all incl. private; accepted
// friend → non-private; stranger/blocked → none).
export async function listRecentSessionsForUser(
  userId: string,
  daysBack = 14
): Promise<Session[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .or(`started_at.gte.${since.toISOString()},ended_at.is.null`)
    .order("started_at", { ascending: false });
  if (!data) return [];
  return (data as SessionRow[]).map(rowToSession);
}
