import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ScheduledBlockStatus = "scheduled" | "done" | "missed" | "moved";

export type ScheduledBlock = {
  id: string;
  goalId: string;
  sessionPlanId: string | null;
  startMs: number;
  endMs: number;
  isFlex: boolean;
  status: ScheduledBlockStatus;
  rescheduledFrom: string | null;
  dismissedAt: number | null;
  createdAt: number;
};

type BlockRow = {
  id: string;
  goal_id: string;
  session_plan_id: string | null;
  start_time: string;
  end_time: string;
  is_flex: boolean;
  status: string;
  rescheduled_from: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const BLOCK_COLUMNS =
  "id, goal_id, session_plan_id, start_time, end_time, is_flex, status, rescheduled_from, dismissed_at, created_at";

function normalizeStatus(s: string): ScheduledBlockStatus {
  return s === "done" || s === "missed" || s === "moved" ? s : "scheduled";
}

function rowToBlock(row: BlockRow): ScheduledBlock {
  return {
    id: row.id,
    goalId: row.goal_id,
    sessionPlanId: row.session_plan_id,
    startMs: new Date(row.start_time).getTime(),
    endMs: new Date(row.end_time).getTime(),
    isFlex: row.is_flex,
    status: normalizeStatus(row.status),
    rescheduledFrom: row.rescheduled_from,
    dismissedAt: row.dismissed_at ? new Date(row.dismissed_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Returns scheduled blocks overlapping [startMs, endMs). RLS scopes to the
// current user. Mirrors lib/db/calendar-events.ts listEventsInRange overlap
// math (start < endMs && end > startMs).
export async function listBlocksInRange(
  startMs: number,
  endMs: number
): Promise<ScheduledBlock[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_blocks")
    .select(BLOCK_COLUMNS)
    .lt("start_time", new Date(endMs).toISOString())
    .gt("end_time", new Date(startMs).toISOString())
    .order("start_time", { ascending: true });
  if (!data) return [];
  return (data as BlockRow[]).map(rowToBlock);
}

// Returns the user's currently-active 'scheduled' block (if any) — the one
// whose [start_time, end_time] window contains nowMs. Used by /clock to
// pre-select goal/plan when clocking in inside a block.
export async function getActiveBlockAtTime(
  nowMs: number
): Promise<ScheduledBlock | null> {
  const supabase = await createClient();
  const nowIso = new Date(nowMs).toISOString();
  const { data } = await supabase
    .from("scheduled_blocks")
    .select(BLOCK_COLUMNS)
    .lte("start_time", nowIso)
    .gte("end_time", nowIso)
    .eq("status", "scheduled")
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return rowToBlock(data as BlockRow);
}

// Missed blocks the user hasn't dismissed yet — what the "Needs reslotting"
// surface reads. Bounded to ~2 weeks back so stale unresolved blocks from
// months ago don't pile up forever.
export async function listMissedNeedingReslot(
  sinceMs: number
): Promise<ScheduledBlock[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_blocks")
    .select(BLOCK_COLUMNS)
    .eq("status", "missed")
    .is("dismissed_at", null)
    .gt("end_time", new Date(sinceMs).toISOString())
    .order("start_time", { ascending: false });
  if (!data) return [];
  return (data as BlockRow[]).map(rowToBlock);
}
