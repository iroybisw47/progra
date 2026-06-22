import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SessionPlanStatus = "planned" | "done";

export type SessionPlan = {
  id: string;
  goalId: string;
  sortOrder: number;
  title: string;
  targetHours: number;
  status: SessionPlanStatus;
  createdAt: number;
};

type SessionPlanRow = {
  id: string;
  goal_id: string;
  sort_order: number;
  title: string;
  target_hours: string | number;
  status: string;
  created_at: string;
};

function rowToPlan(row: SessionPlanRow): SessionPlan {
  return {
    id: row.id,
    goalId: row.goal_id,
    sortOrder: row.sort_order,
    title: row.title,
    targetHours: Number(row.target_hours),
    status: row.status === "done" ? "done" : "planned",
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function listPlansForGoal(goalId: string): Promise<SessionPlan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_plans")
    .select("id, goal_id, sort_order, title, target_hours, status, created_at")
    .eq("goal_id", goalId)
    .order("sort_order", { ascending: true });
  if (!data) return [];
  return (data as SessionPlanRow[]).map(rowToPlan);
}

export async function listPlansForGoals(
  goalIds: string[]
): Promise<SessionPlan[]> {
  if (goalIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_plans")
    .select("id, goal_id, sort_order, title, target_hours, status, created_at")
    .in("goal_id", goalIds)
    .order("sort_order", { ascending: true });
  if (!data) return [];
  return (data as SessionPlanRow[]).map(rowToPlan);
}

// Planned (not-done) session plans the user can attach a new clock-in to.
// RLS scopes to the current user.
export async function listPlannableSessionPlans(): Promise<SessionPlan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_plans")
    .select("id, goal_id, sort_order, title, target_hours, status, created_at")
    .eq("status", "planned")
    .order("goal_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (!data) return [];
  return (data as SessionPlanRow[]).map(rowToPlan);
}
