import "server-only";

import { cache } from "react";

import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import { hydrateUsers, type PublicUser } from "@/lib/db/friends";
import { hydrateGoalTitles } from "@/lib/db/feed";
import { createClient } from "@/lib/supabase/server";
import { LIKE_EMOJI } from "@/lib/social/reactions";

// How far back the Notifications panel looks. Bounds cost and matches the
// "recent activity" spirit of the feed. Tunable.
export const NOTIF_WINDOW_DAYS = 30;
// Hard cap on rendered items (newest-first); older activity is simply omitted.
export const NOTIF_MAX = 50;

// A collapsed "N people liked your session" entry — one per session, Instagram
// style: the reactors accumulate onto a single row.
export type LikeNotification = {
  kind: "like";
  key: string; // `like:${sessionId}`
  sessionId: string;
  sessionLabel: string;
  // Distinct 👍 reactors, most-recent first. May be capped for display by the UI.
  actors: PublicUser[];
  totalActors: number;
  latestAt: number;
  unread: boolean;
};

// One comment on one of my sessions — never collapsed.
export type CommentNotification = {
  kind: "comment";
  key: string; // `comment:${commentId}`
  commentId: string;
  sessionId: string;
  sessionLabel: string;
  author: PublicUser;
  body: string;
  latestAt: number;
  unread: boolean;
};

export type NotificationItem = LikeNotification | CommentNotification;

// The embedded session shape (many-to-one FK). PostgREST returns it as a single
// object; normalize defensively in case a config surfaces it as a one-element
// array.
type EmbeddedSession = {
  user_id: string;
  task_name: string;
  goal_id: string | null;
};
type LikeRow = {
  session_id: string;
  user_id: string;
  created_at: string;
  sessions: EmbeddedSession | EmbeddedSession[] | null;
};
type CommentRow = {
  id: string;
  session_id: string;
  author_id: string;
  body: string;
  created_at: string;
  sessions: EmbeddedSession | EmbeddedSession[] | null;
};

function ms(ts: string | null | undefined): number {
  return ts ? new Date(ts).getTime() : 0;
}

function embeddedSession(
  s: EmbeddedSession | EmbeddedSession[] | null
): EmbeddedSession | null {
  if (!s) return null;
  return Array.isArray(s) ? (s[0] ?? null) : s;
}

function windowStartIso(): string {
  return new Date(
    Date.now() - NOTIF_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

// Recent engagement by *other* users on *my own* sessions, aggregated for the
// Notifications panel: 👍 likes collapsed per session, comments kept individual,
// merged newest-first. Scope is enforced by the embedded `sessions!inner` +
// `sessions.user_id = me` filter (and RLS, which already restricts reactions/
// comments to sessions the viewer can see). Cached per request.
export const listMyNotifications = cache(
  async (): Promise<NotificationItem[]> => {
    const me = await getCurrentUser();
    if (!me) return [];

    const profile = await getProfile();
    const seenMs = ms(profile?.notifications_seen_at);
    const sinceIso = windowStartIso();
    const supabase = await createClient();

    const [likeRes, commentRes] = await Promise.all([
      supabase
        .from("session_reactions")
        .select("session_id, user_id, created_at, sessions!inner(user_id, task_name, goal_id)")
        .eq("sessions.user_id", me.id)
        .eq("emoji", LIKE_EMOJI)
        .neq("user_id", me.id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false }),
      supabase
        .from("session_comments")
        .select("id, session_id, author_id, body, created_at, sessions!inner(user_id, task_name, goal_id)")
        .eq("sessions.user_id", me.id)
        .neq("author_id", me.id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false }),
    ]);

    const likeRows = (likeRes.data ?? []) as LikeRow[];
    const commentRows = (commentRes.data ?? []) as CommentRow[];

    // Group likes by session (rows already newest-first, so the first row per
    // session is the latest and actor order is most-recent-first). Distinct
    // reactors only — a user who reacted twice counts once.
    type LikeGroup = {
      sessionId: string;
      actorIds: string[];
      seen: Set<string>;
      latestAt: number;
      taskName: string;
      goalId: string | null;
    };
    const likeBySession = new Map<string, LikeGroup>();
    for (const row of likeRows) {
      const s = embeddedSession(row.sessions);
      if (!s) continue;
      let g = likeBySession.get(row.session_id);
      if (!g) {
        g = {
          sessionId: row.session_id,
          actorIds: [],
          seen: new Set(),
          latestAt: ms(row.created_at),
          taskName: s.task_name,
          goalId: s.goal_id,
        };
        likeBySession.set(row.session_id, g);
      }
      if (!g.seen.has(row.user_id)) {
        g.seen.add(row.user_id);
        g.actorIds.push(row.user_id);
      }
    }

    // One batched goal-title + user hydration across both result sets. My own
    // goals are always visible to me, so the label rule matches session-detail:
    // goal title when goal-tracked, else the task name.
    const goalIds = [
      ...new Set(
        [
          ...[...likeBySession.values()].map((g) => g.goalId),
          ...commentRows.map((r) => embeddedSession(r.sessions)?.goal_id ?? null),
        ].filter((g): g is string => g != null)
      ),
    ];
    const actorIds = [
      ...new Set([
        ...[...likeBySession.values()].flatMap((g) => g.actorIds),
        ...commentRows.map((r) => r.author_id),
      ]),
    ];
    const [goalTitleById, usersById] = await Promise.all([
      hydrateGoalTitles(goalIds),
      hydrateUsers(actorIds),
    ]);

    const labelFor = (goalId: string | null, taskName: string): string => {
      const goalTitle = goalId ? goalTitleById.get(goalId) : undefined;
      return goalTitle ?? (taskName.trim() || "Untitled session");
    };

    const items: NotificationItem[] = [];

    for (const g of likeBySession.values()) {
      const actors = g.actorIds
        .map((id) => usersById.get(id))
        .filter((u): u is PublicUser => u != null);
      if (actors.length === 0) continue; // reactors we can't resolve → skip
      items.push({
        kind: "like",
        key: `like:${g.sessionId}`,
        sessionId: g.sessionId,
        sessionLabel: labelFor(g.goalId, g.taskName),
        actors,
        totalActors: actors.length,
        latestAt: g.latestAt,
        unread: g.latestAt > seenMs,
      });
    }

    for (const row of commentRows) {
      const s = embeddedSession(row.sessions);
      const author = usersById.get(row.author_id);
      if (!s || !author) continue;
      const at = ms(row.created_at);
      items.push({
        kind: "comment",
        key: `comment:${row.id}`,
        commentId: row.id,
        sessionId: row.session_id,
        sessionLabel: labelFor(s.goal_id, s.task_name),
        author,
        body: row.body,
        latestAt: at,
        unread: at > seenMs,
      });
    }

    items.sort((a, b) => b.latestAt - a.latestAt);
    return items.slice(0, NOTIF_MAX);
  }
);

// Cheap yes/no for the poll-driven dot (wired into getNavBadges in Phase 3):
// is there any 👍-like or comment by someone else on my sessions, in-window,
// newer than when I last opened the panel? Timestamp-only reads, no hydration.
export const hasUnseenNotifications = cache(async (): Promise<boolean> => {
  const me = await getCurrentUser();
  if (!me) return false;

  const profile = await getProfile();
  const seenMs = ms(profile?.notifications_seen_at);
  const sinceIso = windowStartIso();
  const supabase = await createClient();

  const [latestLike, latestComment] = await Promise.all([
    supabase
      .from("session_reactions")
      .select("created_at, sessions!inner(user_id)")
      .eq("sessions.user_id", me.id)
      .eq("emoji", LIKE_EMOJI)
      .neq("user_id", me.id)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => ms((r.data as { created_at: string } | null)?.created_at)),
    supabase
      .from("session_comments")
      .select("created_at, sessions!inner(user_id)")
      .eq("sessions.user_id", me.id)
      .neq("author_id", me.id)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => ms((r.data as { created_at: string } | null)?.created_at)),
  ]);

  return Math.max(latestLike, latestComment) > seenMs;
});
