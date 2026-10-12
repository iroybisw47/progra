import "server-only";

import { cache } from "react";

import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import {
  addDaysISO,
  dueReviewWeek,
  reviewReadyMs,
  weekWindow,
  type WeekWindow,
} from "@/lib/dates";
import { categorizeEvents, fetchEventsRaw } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { getFriendsLeaderboardForWeek } from "@/lib/db/friends-leaderboard";
import { listFriends } from "@/lib/db/friends";
import { listActiveGoals } from "@/lib/db/goals";
import { listActiveHabits, listCompletionsInRange } from "@/lib/db/habits";
import { computeWeekRecap } from "@/lib/db/recap";
import { hasClosedWeeklyReview, hasOpenedRecap } from "@/lib/db/recap-views";
import { listSessionsInRange } from "@/lib/db/sessions";
import {
  averageWindows,
  buildRecapStory,
  MIN_ACTIVE_FRIENDS,
  reviewPostSummary,
  tallyLikes,
  weeklyAverageMs,
  type LikeTally,
  type RecapStoryInput,
  type RecapStoryView,
  type ReviewPostSummary,
} from "@/lib/recap-story";
import { getMyRecapPostForWeek } from "@/lib/db/weekly-reviews";
import { isReviewPostable, type ReviewPostExtras } from "@/lib/weekly-review";
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { createClient } from "@/lib/supabase/server";

// The weekly review's reads (RECAP_V2). Everything here is an existing table
// under RLS — no SQL, no RPC — composed into the plain view the story draws
// (lib/recap-story.ts decides what it says). Every helper is cache()'d, and
// the expensive composer is NOT folded into computeWeekRecap, which Progress
// calls on every render.

function createdMsOf(createdAt: string | null | undefined): number {
  return createdAt ? new Date(createdAt).getTime() : 0;
}

// The review that should open by itself right now, or null: the last
// completed week from Monday 06:00 local (lib/dates dueReviewWeek), not yet
// closed (recap_views). Fails CLOSED everywhere — an unparseable stored
// timezone (Intl throws) or a failed read means no takeover, never a broken or
// repeating one. The profile is the layout's, already cached, so the one query
// is hasOpenedRecap.
export const getDueReview = cache(async (): Promise<WeekWindow | null> => {
  const profile = await getProfile();
  if (!profile) return null;
  let week: WeekWindow | null;
  try {
    week = dueReviewWeek(profile.timezone ?? "UTC", Date.now(), createdMsOf(profile.created_at));
  } catch {
    return null;
  }
  if (!week) return null;
  return (await hasOpenedRecap(week.weekStartMs)) ? null : week;
});

// Whether closing the review of `win` should record it as seen: only once the
// week's review is actually out (Monday 06:00 after it) and not already
// marked. Opening a week early through its URL must not swallow the
// auto-open that's coming.
export const isReviewMarkable = cache(
  async (weekStartISO: string, weekStartMs: number): Promise<boolean> => {
    const profile = await getProfile();
    try {
      if (Date.now() < reviewReadyMs(weekStartISO, profile?.timezone ?? "UTC")) return false;
    } catch {
      return false;
    }
    return !(await hasOpenedRecap(weekStartMs));
  }
);

type ReceivedRow = { user_id: string; created_at: string };
type GivenRow = { created_at: string; sessions: { user_id: string } | { user_id: string }[] | null };

// The week's 👍 likes — the feed's heart stores LIKE_EMOJI — tallied by the
// other person: who liked my posts, and whose posts I liked. The query shape
// is listMyNotifications' (lib/db/notifications-activity.ts): the post's owner
// comes through the embedded `sessions!inner`, and RLS (can_see_session) only
// returns reactions on posts I can still see. Filtering to CURRENT friends is
// lib/recap-story's job, so an unfriended or blocked person never surfaces.
export const getWeekLikes = cache(
  async (
    weekStartMs: number,
    weekEndMs: number
  ): Promise<{ given: LikeTally[]; received: LikeTally[] }> => {
    const me = await getCurrentUser();
    if (!me) return { given: [], received: [] };
    const startIso = new Date(weekStartMs).toISOString();
    const endIso = new Date(weekEndMs).toISOString();
    const supabase = await createClient();

    const [received, given] = await Promise.all([
      supabase
        .from("session_reactions")
        .select("user_id, created_at, sessions!inner(user_id)")
        .eq("sessions.user_id", me.id)
        .eq("emoji", LIKE_EMOJI)
        .neq("user_id", me.id)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("session_reactions")
        .select("created_at, sessions!inner(user_id)")
        .eq("user_id", me.id)
        .eq("emoji", LIKE_EMOJI)
        .neq("sessions.user_id", me.id)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
    ]);

    const ownerOf = (s: GivenRow["sessions"]) => (Array.isArray(s) ? s[0] : s)?.user_id ?? null;
    return {
      received: tallyLikes(
        ((received.data ?? []) as ReceivedRow[]).map((r) => ({
          userId: r.user_id,
          createdMs: new Date(r.created_at).getTime(),
        }))
      ),
      given: tallyLikes(
        ((given.data ?? []) as unknown as GivenRow[])
          .map((r) => ({ userId: ownerOf(r.sessions), createdMs: new Date(r.created_at).getTime() }))
          .filter((r): r is { userId: string; createdMs: number } => r.userId !== null)
      ),
    };
  }
);

// "Your weekly average": the 8 completed weeks before `weekStartISO` that
// ended after signup, quiet weeks counting as zero (owner, 2026-10-11). One
// read of the whole span, then each week through aggregateRange — the same
// attribution as every recap, so each week's figure is its own review's.
export const getWeeklyAverageMs = cache(
  async (weekStartISO: string, tz: string, createdMs: number): Promise<number | null> => {
    const windows = averageWindows(weekStartISO, tz, createdMs);
    if (windows.length === 0) return null;
    const from = windows[windows.length - 1].weekStartMs;
    const to = windows[0].weekEndMs;
    const [sessions, raw, categories] = await Promise.all([
      listSessionsInRange(from, to),
      fetchEventsRaw(from, to),
      listCategories(),
    ]);
    // Categorizing drops excluded events, which the totals must not count.
    return weeklyAverageMs(sessions, categorizeEvents(raw, categories), windows, Date.now());
  }
);

// Goals and habits made AFTER the week can't have been part of it — a goal set
// on Monday morning would otherwise drag last week's percentage down. Shared by
// the story and the post, so the two can't disagree.
function weekGoals(
  goals: Awaited<ReturnType<typeof listActiveGoals>>,
  goalRows: { id: string; actualMs: number }[],
  weekEndMs: number
): RecapStoryInput["goals"] {
  const actualById = new Map(goalRows.map((g) => [g.id, g.actualMs]));
  return goals
    .filter((g) => g.createdAt <= weekEndMs)
    .map((g) => ({
      id: g.id,
      title: g.title,
      color: g.color,
      quotaHours: g.weeklyQuotaHours,
      actualMs: actualById.get(g.id) ?? 0,
    }));
}

function weekHabits(
  habits: Awaited<ReturnType<typeof listActiveHabits>>,
  weekEndMs: number
): RecapStoryInput["habits"] {
  return habits
    .filter((h) => h.createdAt <= weekEndMs)
    .map((h) => ({ id: h.id, name: h.name, color: h.color }));
}

function postableNow(weekStartISO: string, tz: string, createdMs: number): boolean {
  try {
    return isReviewPostable(weekStartISO, tz, Date.now(), createdMs);
  } catch {
    return false;
  }
}

// Everything the story shows for the week starting `weekStartISO` (any date in
// it; snapped to its Monday in the user's timezone), in one parallel wave.
export const loadRecapStory = cache(async (weekStartISO: string): Promise<RecapStoryView> => {
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const win = weekWindow(tz, weekStartISO);
  const createdMs = createdMsOf(profile?.created_at);

  const [recap, categories, goals, circle, habits, completions, likes, averageMs, friends, seenOne, posted] =
    await Promise.all([
      computeWeekRecap(win.weekStartMs, win.weekEndMs),
      listCategories(),
      listActiveGoals(),
      getFriendsLeaderboardForWeek(win.weekStartMs, win.weekEndMs),
      listActiveHabits(),
      listCompletionsInRange(win.weekStartISO, addDaysISO(win.weekStartISO, 6)),
      getWeekLikes(win.weekStartMs, win.weekEndMs),
      getWeeklyAverageMs(win.weekStartISO, tz, createdMs),
      listFriends(),
      hasClosedWeeklyReview(),
      getMyRecapPostForWeek(win.weekStartMs),
    ]);

  // Time under a category deleted since is uncategorized now — it'd otherwise
  // arrive as a second "Uncategorized" row with an id of its own.
  const liveCategory = new Set(categories.map((c) => c.id));
  return buildRecapStory({
    weekStartISO: win.weekStartISO,
    totalTrackedMs: recap.totalTrackedMs,
    weeklyAverageMs: averageMs,
    categories: recap.categoryRows.map((r) => ({
      id: r.id === null || r.isGoal || liveCategory.has(r.id) ? r.id : null,
      name: r.name,
      color: r.color,
      ms: r.ms,
    })),
    goals: weekGoals(goals, recap.goalRows, win.weekEndMs),
    habits: weekHabits(habits, win.weekEndMs),
    completions: completions.map((c) => ({ habitId: c.habitId, completedOn: c.completedOn })),
    circle: circle.map((r) => ({
      user: {
        userId: r.user.userId,
        username: r.user.username,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
      },
      isMe: r.isMe,
      rank: r.rank,
      totalMs: r.totalMs,
      goalCount: r.goalCount,
    })),
    friends: friends.map((f) => ({
      userId: f.user.userId,
      username: f.user.username,
      displayName: f.user.displayName,
      avatarUrl: f.user.avatarUrl,
    })),
    likesGiven: likes.given,
    likesReceived: likes.received,
    firstReview: !seenOne,
    share: { postable: postableNow(win.weekStartISO, tz, createdMs), posted },
  });
});

// What posting the week writes, recomputed on the server from the same reads
// and the same rules as the story (lib/recap-story reviewPostSummary) — the
// client sends a week and a caption, never a number. Null when the week can't
// be posted (its review isn't out, or it predates the account).
export async function loadReviewPost(weekStartISO: string): Promise<{
  weekStartMs: number;
  summary: ReviewPostSummary;
  extras: ReviewPostExtras;
} | null> {
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const win = weekWindow(tz, weekStartISO);
  if (!postableNow(win.weekStartISO, tz, createdMsOf(profile?.created_at))) return null;

  const [recap, goals, habits, completions, circle] = await Promise.all([
    computeWeekRecap(win.weekStartMs, win.weekEndMs),
    listActiveGoals(),
    listActiveHabits(),
    listCompletionsInRange(win.weekStartISO, addDaysISO(win.weekStartISO, 6)),
    getFriendsLeaderboardForWeek(win.weekStartMs, win.weekEndMs),
  ]);
  const me = circle.find((r) => r.isMe);
  const activeFriends = circle.filter((r) => !r.isMe).length;
  return {
    weekStartMs: win.weekStartMs,
    summary: reviewPostSummary({
      weekStartISO: win.weekStartISO,
      totalTrackedMs: recap.totalTrackedMs,
      goals: weekGoals(goals, recap.goalRows, win.weekEndMs),
      habits: weekHabits(habits, win.weekEndMs),
      completions: completions.map((c) => ({ habitId: c.habitId, completedOn: c.completedOn })),
    }),
    extras: {
      // Stored only where the story itself shows a rank.
      rank: me && activeFriends >= MIN_ACTIVE_FRIENDS ? me.rank : null,
      circleSize: circle.length,
      categories: recap.categoryRows.slice(0, 4).map((r) => ({ name: r.name, color: r.color, ms: r.ms })),
    },
  };
}
