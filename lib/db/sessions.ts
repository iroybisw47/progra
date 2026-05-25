import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/storage";

type SessionRow = {
  id: string;
  category_id: string | null;
  task_name: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
};

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    categoryId: row.category_id,
    taskName: row.task_name,
    description: row.description ?? undefined,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
  };
}

// Returns sessions started within the last `daysBack` days OR any still-active
// session regardless of start time. The clock page only needs this-week math
// plus the live timer, so a 60-day window is plenty.
export async function listRecentSessions(daysBack = 60): Promise<Session[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data } = await supabase
    .from("sessions")
    .select("id, category_id, task_name, description, started_at, ended_at")
    .or(`started_at.gte.${since.toISOString()},ended_at.is.null`)
    .order("started_at", { ascending: false });

  if (!data) return [];
  return (data as SessionRow[]).map(rowToSession);
}
