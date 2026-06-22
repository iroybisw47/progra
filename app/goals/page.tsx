import { aggregateWeekByGoal } from "@/lib/aggregate";
import { listActiveGoals } from "@/lib/db/goals";
import { listPlansForGoals } from "@/lib/db/session-plans";
import { listRecentSessions } from "@/lib/db/sessions";

import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const [goals, sessions] = await Promise.all([
    listActiveGoals(),
    listRecentSessions(),
  ]);
  const plans =
    goals.length > 0
      ? await listPlansForGoals(goals.map((g) => g.id))
      : [];

  const planToGoal = new Map(plans.map((p) => [p.id, p.goalId] as const));
  const { perGoal, untracked } = aggregateWeekByGoal(
    sessions,
    planToGoal,
    Date.now()
  );

  // Flatten Map → Record for the server→client boundary.
  const actualMsByGoal: Record<string, number> = {};
  for (const [k, v] of perGoal) actualMsByGoal[k] = v;

  return (
    <GoalsClient
      goals={goals}
      plans={plans}
      actualMsByGoal={actualMsByGoal}
      untrackedMs={untracked}
    />
  );
}
