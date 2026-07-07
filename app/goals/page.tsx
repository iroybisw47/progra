import { aggregateWeekByGoal } from "@/lib/aggregate";
import { endOfWeek, startOfWeek } from "@/lib/dates";
import { listActiveGoals } from "@/lib/db/goals";
import { listRecentSessions } from "@/lib/db/sessions";
import { sessionWorkedMs } from "@/lib/session";

import { GoalsClient, type GoalSessionInfo } from "./goals-client";

export default async function GoalsPage() {
  const [goals, sessions] = await Promise.all([
    listActiveGoals(),
    listRecentSessions(),
  ]);

  const now = Date.now();
  const { perGoal } = aggregateWeekByGoal(sessions, now);

  // Flatten Map → Record for the server→client boundary.
  const actualMsByGoal: Record<string, number> = {};
  for (const [k, v] of perGoal) actualMsByGoal[k] = v;

  // This week's goal-attributed sessions, grouped per goal, newest first —
  // shown under each goal's quota bar. Attribution mirrors aggregateWeekByGoal:
  // a session belongs to the week of its end instant (or `now` while active).
  const weekStart = startOfWeek(new Date(now)).getTime();
  const weekEnd = endOfWeek(new Date(now)).getTime();
  const sessionsByGoal: Record<string, GoalSessionInfo[]> = {};
  for (const s of sessions) {
    if (!s.goalId) continue;
    const end = s.endedAt ?? now;
    if (end < weekStart || end > weekEnd) continue;
    const ms = sessionWorkedMs(s, now);
    if (ms <= 0) continue;
    (sessionsByGoal[s.goalId] ??= []).push({
      id: s.id,
      title: s.taskName.trim() || "Untitled session",
      ms,
      startMs: s.startedAt,
      endMs: s.endedAt,
    });
  }
  for (const list of Object.values(sessionsByGoal)) {
    list.sort((a, b) => b.startMs - a.startMs);
  }

  return (
    <GoalsClient
      goals={goals}
      actualMsByGoal={actualMsByGoal}
      sessionsByGoal={sessionsByGoal}
    />
  );
}
