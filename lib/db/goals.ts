import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { JOHN } from "@/lib/flags";
import { friendVisibleGoals } from "@/lib/friends-tab";
import { normalizeFill } from "@/lib/palette";
import { isUuid } from "@/lib/validate";

export type GoalStatus = "active" | "archived";

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  weeklyQuotaHours: number;
  status: GoalStatus;
  createdAt: number;
  // One of the nine palette hues (lib/category-colors.ts), or null for goals
  // created before the column existed — those fall back to a hue derived from
  // the id (goalColorOf), so every goal has a stable color either way.
  color: string | null;
  // Social v2: false = visible to accepted friends (once the Aspect 4 RLS
  // rewrite lands), true = owner-only. Inert until then.
  isPrivate: boolean;
  // John (two-user test): an optional real-world date the goal is pacing
  // toward, and what "done" looks like in words.
  //
  // OPTIONAL KEYS, and absent rather than null when the reader did not ask for
  // them — only listActiveGoals selects them, and only under the flag. That
  // keeps "this goal has no deadline" distinguishable from "this reader never
  // looked", which matters because listActiveGoalsForUser (friends' profiles)
  // deliberately never looks.
  deadlineOn?: string | null; // YYYY-MM-DD
  targetOutcome?: string | null;
};

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  weekly_quota_hours: string | number;
  status: string;
  created_at: string;
  is_private: boolean;
  color: string | null;
  // Only present on the John-flagged read; see GOAL_COLUMNS_JOHN.
  deadline_on?: string | null;
  target_outcome?: string | null;
};

// The shared select list. Was duplicated verbatim across five readers, which is
// how a column gets forgotten on a new query — the same reason
// SESSION_COLUMNS exists.
export const GOAL_COLUMNS =
  "id, title, description, weekly_quota_hours, status, created_at, is_private, color";

// John's two extra columns. Appended by listActiveGoals ONLY:
// listActiveGoalsForUser reads a FRIEND's goals, and a friend's deadline is not
// theirs to see. Flag-gated so the columns are never named before the SQL runs.
//
// Typed as plain `string`, not a literal: PostgREST's generated types parse the
// select list at the type level, and a runtime ternary makes that a union it
// resolves to ParserError. The rowToGoal cast below is the type authority here
// either way.
const GOAL_COLUMNS_JOHN: string = JOHN
  ? `${GOAL_COLUMNS}, deadline_on, target_outcome`
  : GOAL_COLUMNS;

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    // PostgREST returns numeric columns as strings; normalize to number.
    weeklyQuotaHours: Number(row.weekly_quota_hours),
    status: row.status === "archived" ? "archived" : "active",
    createdAt: new Date(row.created_at).getTime(),
    isPrivate: row.is_private ?? false,
    color: normalizeFill(row.color),
    // Absent, not null, when the reader did not select them — see the Goal type.
    ...(row.deadline_on !== undefined ? { deadlineOn: row.deadline_on } : {}),
    ...(row.target_outcome !== undefined
      ? { targetOutcome: row.target_outcome }
      : {}),
  };
}

// Cached per request — the recap, rollup, and clock composers all read active
// goals during one render; they share a single round-trip.
export const listActiveGoals = cache(async (): Promise<Goal[]> => {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS_JOHN)
    .eq("user_id", me.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (!data) return [];
  // Double cast: with a non-literal select list PostgREST infers
  // GenericStringError[] rather than a row shape, so GoalRow is the contract
  // here — kept honest by deadline_on / target_outcome being OPTIONAL on it.
  return (data as unknown as GoalRow[]).map(rowToGoal);
});

// Every goal, archived included, oldest first. History looks at past windows,
// where a goal the user has since archived still owned real hours — excluding
// it would silently drop that time from the breakdown and leave its synthetic
// `goal:<id>` row nameless. Cached per request alongside listActiveGoals.
//
// This is for RESOLVING past time only (the History "Time" breakdown). Goal
// completion filters back down to active goals: the UI calls archiving
// "Delete", so a deleted goal must not keep being scored against its quota.
export const listAllGoals = cache(async (): Promise<Goal[]> => {
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("user_id", me.id)
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as GoalRow[]).map(rowToGoal);
});

// Returns goals by id regardless of status. Used by the "needs reslotting"
// surface to backfill titles for missed blocks pointing at goals the user
// has since archived (which `listActiveGoals` correctly excludes).
export async function getGoalsByIds(ids: string[]): Promise<Goal[]> {
  if (ids.length === 0) return [];
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("user_id", me.id)
    .in("id", ids);
  if (!data) return [];
  return (data as GoalRow[]).map(rowToGoal);
}

export async function getGoal(id: string): Promise<Goal | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("user_id", me.id)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return rowToGoal(data as GoalRow);
}

// Cross-user read (social v2 profile pages): another user's active goals.
// No owner guard — RLS decides visibility (owner → all incl. private; accepted
// friend → non-private; stranger/blocked → none).
export async function listActiveGoalsForUser(userId: string): Promise<Goal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as GoalRow[]).map(rowToGoal);
}

// A goal with its owner, for reads that span several people.
export type UserGoal = Goal & { userId: string };

// Several FRIENDS' active goals in one round-trip, oldest first: the v3
// Friends tab's "Working on {goal}" fallback, for a friend who hasn't put
// time into a goal this week (lib/friends-tab.ts buildFriendRows, plan P8).
//
// It must never hand back a private goal, and it doesn't leave that to RLS
// alone. Three layers, any one of which is enough on its own:
//   1. the query asks only for `is_private = false`, and never for the
//      caller's own rows (the owner branch of the policy would return their
//      private goals);
//   2. friendVisibleGoals drops anything private, or the caller's, from what
//      came back (pinned by lib/friends-tab.test.ts);
//   3. goals RLS is `owner OR are_friends AND NOT is_private`, so a friend's
//      private goal and a stranger's goals don't arrive in the first place.
// Unlike listActiveGoalsForUser (one friend's profile), which leans on RLS
// by design because the owner viewing their own profile should see theirs.
//
// cache() keys its arguments by identity, so an array would never hit: two
// readers building the same list of ids in one render would each pay for a
// query. The ids are turned into one canonical string first (non-UUIDs
// dropped, since they go into a filter, deduped, sorted), and THAT is the
// cached call's argument.
const listActiveGoalsForKey = cache(async (key: string): Promise<UserGoal[]> => {
  if (!key) return [];
  const me = await getCurrentUser();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(`${GOAL_COLUMNS}, user_id`)
    .in("user_id", key.split(","))
    .neq("user_id", me.id)
    .eq("status", "active")
    .eq("is_private", false)
    .order("created_at", { ascending: true });
  if (!data) return [];
  const goals = (data as (GoalRow & { user_id: string })[]).map((row) => ({
    ...rowToGoal(row),
    userId: row.user_id,
  }));
  return friendVisibleGoals(goals, me.id);
});

export function listActiveGoalsForUsers(userIds: readonly string[]): Promise<UserGoal[]> {
  const key = [...new Set(userIds.filter((id) => isUuid(id)))].sort().join(",");
  return listActiveGoalsForKey(key);
}
