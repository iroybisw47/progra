import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/storage";

type SessionRow = {
  id: string;
  category_id: string | null;
  session_plan_id: string | null;
  task_name: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
};

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    categoryId: row.category_id,
    sessionPlanId: row.session_plan_id,
    taskName: row.task_name,
    description: row.description ?? undefined,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
  };
}

// Returns sessions overlapping [startMs, endMs). Overlap test: started_at <
// endMs AND (ended_at > startMs OR ended_at IS NULL). Used by the recap to
// fetch arbitrary historical weeks — listRecentSessions caps at ~14 days.
export async function listSessionsInRange(
  startMs: number,
  endMs: number
): Promise<Session[]> {
  const supabase = await createClient();
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const { data } = await supabase
    .from("sessions")
    .select(
      "id, category_id, session_plan_id, task_name, description, started_at, ended_at"
    )
    .lt("started_at", endIso)
    .or(`ended_at.gt.${startIso},ended_at.is.null`)
    .order("started_at", { ascending: false });
  if (!data) return [];
  return (data as SessionRow[]).map(rowToSession);
}

// Returns sessions started within the last `daysBack` days OR any still-active
// session regardless of start time. The clock page only renders the current
// week, so 14 days is plenty (covers Monday-week start when today is Sunday
// plus a tz-safety buffer); active sessions are returned via the OR clause
// even if they started earlier.
export async function listRecentSessions(daysBack = 14): Promise<Session[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data } = await supabase
    .from("sessions")
    .select(
      "id, category_id, session_plan_id, task_name, description, started_at, ended_at"
    )
    .or(`started_at.gte.${since.toISOString()},ended_at.is.null`)
    .order("started_at", { ascending: false });

  if (!data) return [];
  return (data as SessionRow[]).map(rowToSession);
}
