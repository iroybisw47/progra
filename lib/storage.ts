// Shared data types. App data lives in Supabase — see app/actions/* for
// mutations and lib/db/* for reads. This file is types-only now; the previous
// localStorage helpers were removed when /clock and /calendar moved to the DB.

export type CategoryRules = {
  titleContains?: string[];
};

export type Category = {
  id: string;
  name: string;
  color: string | null;
  rules: CategoryRules;
  createdAt: number;
};

export type Session = {
  id: string;
  // A session is attributed to EITHER a category OR a goal (mutually
  // exclusive; enforced at clock-in and in updateSession). `sessionPlanId`
  // is legacy — the planner still reads it, but the goal flow now links a
  // session straight to a goal via `goalId`.
  categoryId: string | null;
  goalId: string | null;
  sessionPlanId: string | null;
  taskName: string;
  description?: string;
  startedAt: number;
  endedAt: number | null;
  // Pause tracking. `startedAt`/`endedAt` stay real wall-clock times; worked
  // time = (end - start) - pausedMs - (current pause). `pausedMs` is banked
  // paused time from resumed pauses; `pausedSince` is set (ms) only while the
  // session is currently paused, null otherwise. See lib/session.ts.
  pausedMs: number;
  pausedSince: number | null;
};
