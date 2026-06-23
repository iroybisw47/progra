import "server-only";

import { createClient } from "@/lib/supabase/server";

export type GoalStatus = "active" | "archived";

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  weeklyQuotaHours: number;
  status: GoalStatus;
  createdAt: number;
};

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  weekly_quota_hours: string | number;
  status: string;
  created_at: string;
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
  };
}

export async function listActiveGoals(): Promise<Goal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("id, title, description, weekly_quota_hours, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as GoalRow[]).map(rowToGoal);
}

// Returns goals by id regardless of status. Used by the "needs reslotting"
// surface to backfill titles for missed blocks pointing at goals the user
// has since archived (which `listActiveGoals` correctly excludes).
export async function getGoalsByIds(ids: string[]): Promise<Goal[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("id, title, description, weekly_quota_hours, status, created_at")
    .in("id", ids);
  if (!data) return [];
  return (data as GoalRow[]).map(rowToGoal);
}

export async function getGoal(id: string): Promise<Goal | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("id, title, description, weekly_quota_hours, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return rowToGoal(data as GoalRow);
}
