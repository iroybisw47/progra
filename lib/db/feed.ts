import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listFriends, type PublicUser } from "@/lib/db/friends";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import { sessionWorkedMs } from "@/lib/session";

// One entry in the Home feed: a friend's finished work session.
export type FeedItem = {
  sessionId: string;
  author: PublicUser;
  // What they worked on: the goal title when the session is goal-tracked and the
  // goal is visible to us, otherwise the free-text task name.
  label: string;
  isGoal: boolean;
  workedMs: number;
  startedAt: number;
  endedAt: number;
};

// A friend who is currently clocked in (active session, ended_at IS NULL). The
// timing fields let the client compute a live worked-duration + paused state via
// sessionWorkedMs / isPaused without re-fetching.
export type ClockedInItem = {
  sessionId: string;
  author: PublicUser;
  label: string;
  isGoal: boolean;
  startedAt: number;
  pausedMs: number;
  pausedSince: number | null;
};

type FeedSessionRow = SessionRow & { user_id: string };

// The Home feed: accepted friends' finished sessions from the last `daysBack`
// days, newest-finished first. Reads are RLS-gated (owner OR are_friends AND NOT
// is_private), so private / non-friend / blocked rows never arrive here — the
// app does not re-filter. Batched over all friend ids in one query; an empty
// friend set short-circuits (never an empty .in()).
export async function listFriendFeed(daysBack = 7): Promise<FeedItem[]> {
  const friends = await listFriends();
  if (friends.length === 0) return [];

  const authorById = new Map(friends.map((f) => [f.user.userId, f.user]));
  const friendIds = friends.map((f) => f.user.userId);

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data } = await supabase
    .from("sessions")
    .select(`${SESSION_COLUMNS}, user_id`)
    .in("user_id", friendIds)
    .not("ended_at", "is", null)
    .gte("ended_at", since.toISOString())
    .order("ended_at", { ascending: false });
  if (!data) return [];

  const rows = data as FeedSessionRow[];

  // Resolve goal titles in one batched read. A goal's title is only readable
  // when the goal is visible to us (non-private, RLS); a session tracked to a
  // friend's *private* goal falls back to its task name, so private goal titles
  // never leak into the feed.
  const goalIds = [
    ...new Set(
      rows.map((r) => r.goal_id).filter((g): g is string => g != null)
    ),
  ];
  const goalTitleById = await hydrateGoalTitles(goalIds);

  const now = Date.now();
  return rows.flatMap((row) => {
    const author = authorById.get(row.user_id);
    if (!author) return [];
    const session = rowToSession(row);
    if (session.endedAt == null) return [];
    const goalTitle = row.goal_id ? goalTitleById.get(row.goal_id) : undefined;
    const label = goalTitle ?? (session.taskName.trim() || "Untitled session");
    return [
      {
        sessionId: session.id,
        author,
        label,
        isGoal: goalTitle != null,
        workedMs: sessionWorkedMs(session, now),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
    ];
  });
}

// Friends who are clocked in right now: accepted friends' active sessions
// (ended_at IS NULL, at most one per user). Same RLS as the feed, so a friend's
// private active session is filtered at the DB and never appears. Empty friend
// set short-circuits.
export async function listClockedInNow(): Promise<ClockedInItem[]> {
  const friends = await listFriends();
  if (friends.length === 0) return [];

  const authorById = new Map(friends.map((f) => [f.user.userId, f.user]));
  const friendIds = friends.map((f) => f.user.userId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(`${SESSION_COLUMNS}, user_id`)
    .in("user_id", friendIds)
    .is("ended_at", null)
    .order("started_at", { ascending: false });
  if (!data) return [];

  const rows = data as FeedSessionRow[];
  const goalIds = [
    ...new Set(
      rows.map((r) => r.goal_id).filter((g): g is string => g != null)
    ),
  ];
  const goalTitleById = await hydrateGoalTitles(goalIds);

  return rows.flatMap((row) => {
    const author = authorById.get(row.user_id);
    if (!author) return [];
    const session = rowToSession(row);
    const goalTitle = row.goal_id ? goalTitleById.get(row.goal_id) : undefined;
    const label = goalTitle ?? (session.taskName.trim() || "Untitled session");
    return [
      {
        sessionId: session.id,
        author,
        label,
        isGoal: goalTitle != null,
        startedAt: session.startedAt,
        pausedMs: session.pausedMs,
        pausedSince: session.pausedSince,
      },
    ];
  });
}

// Batch-resolve goal id → title, RLS-gated (only goals visible to us return).
export async function hydrateGoalTitles(
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("goals").select("id, title").in("id", ids);
  if (!data) return map;
  for (const row of data as { id: string; title: string }[]) {
    map.set(row.id, row.title);
  }
  return map;
}
