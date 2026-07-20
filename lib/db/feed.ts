import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listFriends, type PublicUser } from "@/lib/db/friends";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import { hydrateSessionPhotoUrls } from "@/lib/db/session-photos";
import { sessionWorkedMs } from "@/lib/session";

// The goal or category a session is filed under. isGoal drives the goal star vs
// category dot; color is the category's dot color (null for goals, which use the
// star, and for colorless categories).
export type FeedAttribution = {
  text: string;
  isGoal: boolean;
  color: string | null;
};

// One entry in the Home feed: a friend's finished work session.
export type FeedItem = {
  kind: "session";
  sessionId: string;
  author: PublicUser;
  // The task title — what they typed they were working on.
  title: string;
  // The goal (visible, non-private) or category the session is filed under, or
  // null when uncategorized or the goal is private (private goal titles never
  // leak — no stand-in is shown).
  attribution: FeedAttribution | null;
  description: string | null;
  workedMs: number;
  startedAt: number;
  endedAt: number;
  // Signed URL (1h) for the session's photo, null when it has none or storage
  // declined to sign it.
  photoUrl: string | null;
};

// A synthetic "just joined Progra" entry, derived from a friend's onboarded_at
// (not a session row). No reactions/comments — those are session-keyed.
export type JoinFeedItem = {
  kind: "join";
  id: string; // synthetic, e.g. `join:${userId}`
  author: PublicUser;
  firstGoalTitle: string | null; // null until they have a visible goal
  joinedAt: number; // onboarded_at, epoch ms
};

// Anything that can appear in the merged Home feed.
export type FeedEntry = FeedItem | JoinFeedItem;

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
  const categoryIds = [
    ...new Set(
      rows.map((r) => r.category_id).filter((c): c is string => c != null)
    ),
  ];
  // Every photo across every card signs in one batched call. The storage policy
  // still decides each path, so a photo we may not read just doesn't come back.
  const photoPaths = [
    ...new Set(
      rows.map((r) => r.photo_path).filter((p): p is string => p != null)
    ),
  ];
  const [goalTitleById, categoryNameById, photoUrlByPath] = await Promise.all([
    hydrateGoalTitles(goalIds),
    hydrateCategoryNames(categoryIds),
    hydrateSessionPhotoUrls(photoPaths),
  ]);

  const now = Date.now();
  return rows.flatMap((row) => {
    const author = authorById.get(row.user_id);
    if (!author) return [];
    const session = rowToSession(row);
    if (session.endedAt == null) return [];
    return [
      {
        kind: "session" as const,
        sessionId: session.id,
        author,
        title: session.taskName.trim() || "Untitled session",
        attribution: resolveFeedAttribution(
          row,
          goalTitleById,
          categoryNameById
        ),
        description: session.description?.trim() || null,
        workedMs: sessionWorkedMs(session, now),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        photoUrl: session.photoPath
          ? (photoUrlByPath.get(session.photoPath) ?? null)
          : null,
      },
    ];
  });
}

// Goal title (goal-tracked, visible) → category name (category-tracked, visible)
// → null. A private/hidden goal yields null rather than falling through to a
// category, so a private goal's title is never replaced by a stand-in.
function resolveFeedAttribution(
  row: FeedSessionRow,
  goalTitleById: Map<string, string>,
  categoryById: Map<string, { name: string; color: string | null }>
): FeedAttribution | null {
  if (row.goal_id) {
    const title = goalTitleById.get(row.goal_id);
    return title ? { text: title, isGoal: true, color: null } : null;
  }
  if (row.category_id) {
    const cat = categoryById.get(row.category_id);
    return cat
      ? { text: cat.name, isGoal: false, color: cat.color }
      : null;
  }
  return null;
}

// Batch-resolve category id → name via the friend-gated public_categories view
// (exposes only id/name/color for own + friends' categories). An absent view or
// a non-friend category simply doesn't resolve, so the chip is omitted rather
// than leaking. Empty set short-circuits (never an empty .in()).
async function hydrateCategoryNames(
  ids: string[]
): Promise<Map<string, { name: string; color: string | null }>> {
  const map = new Map<string, { name: string; color: string | null }>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_categories")
    .select("id, name, color")
    .in("id", ids);
  if (!data) return map;
  for (const row of data as {
    id: string;
    name: string;
    color: string | null;
  }[]) {
    map.set(row.id, { name: row.name, color: row.color ?? null });
  }
  return map;
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

// Accepted friends who joined (completed onboarding) within the last `daysBack`
// days, as synthetic "just joined Progra" feed entries. The join moment is
// profiles.onboarded_at, read through the public_profiles view (must expose
// onboarded_at). Their first *visible* goal is attached when one exists; RLS
// hides private/non-friend goals, so a private first goal degrades to no title.
// Empty friend set short-circuits (never an empty .in()).
export async function listFriendJoins(daysBack = 7): Promise<JoinFeedItem[]> {
  const friends = await listFriends();
  if (friends.length === 0) return [];

  const authorById = new Map(friends.map((f) => [f.user.userId, f.user]));
  const friendIds = friends.map((f) => f.user.userId);

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // onboarded_at lives on the public_profiles view. `gte` drops null values, so
  // only friends who joined within the window come back. If the view doesn't
  // expose the column yet the query yields nothing and joins are simply absent.
  const { data } = await supabase
    .from("public_profiles")
    .select("id, onboarded_at")
    .in("id", friendIds)
    .gte("onboarded_at", since.toISOString());
  if (!data) return [];

  const rows = data as { id: string; onboarded_at: string | null }[];
  const firstGoalByUser = await hydrateFirstGoalTitles(rows.map((r) => r.id));

  return rows.flatMap((row) => {
    const author = authorById.get(row.id);
    if (!author || !row.onboarded_at) return [];
    return [
      {
        kind: "join" as const,
        id: `join:${row.id}`,
        author,
        firstGoalTitle: firstGoalByUser.get(row.id) ?? null,
        joinedAt: new Date(row.onboarded_at).getTime(),
      },
    ];
  });
}

// Batch-resolve user id → their earliest *visible* active goal title. RLS gates
// the read (only non-private, friend-visible goals return), so a user whose
// earliest goal is private yields their first visible one, or none. created_at
// ascending + "first write wins" keeps the earliest per user.
async function hydrateFirstGoalTitles(
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("user_id, title, created_at")
    .eq("status", "active")
    .in("user_id", userIds)
    .order("created_at", { ascending: true });
  if (!data) return map;
  for (const row of data as { user_id: string; title: string }[]) {
    if (!map.has(row.user_id)) map.set(row.user_id, row.title);
  }
  return map;
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
