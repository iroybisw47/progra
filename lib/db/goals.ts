import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export type GoalStatus = "active" | "archived";

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  weeklyQuotaHours: number;
  status: GoalStatus;
  createdAt: number;
  // Social v2: false = visible to accepted friends (once the Aspect 4 RLS
  // rewrite lands), true = owner-only. Inert until then.
  isPrivate: boolean;
};

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  weekly_quota_hours: string | number;
  status: string;
  created_at: string;
  is_private: boolean;
};

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
    .select("id, title, description, weekly_quota_hours, status, created_at, is_private")
    .eq("user_id", me.id)
    .eq("status", "active")
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
    .select("id, title, description, weekly_quota_hours, status, created_at, is_private")
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
    .select("id, title, description, weekly_quota_hours, status, created_at, is_private")
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
    .select("id, title, description, weekly_quota_hours, status, created_at, is_private")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as GoalRow[]).map(rowToGoal);
}
