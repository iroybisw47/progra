import { listActiveGoals } from "@/lib/db/goals";
import { listPlansForGoals } from "@/lib/db/session-plans";

import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const goals = await listActiveGoals();
  const plans =
    goals.length > 0
      ? await listPlansForGoals(goals.map((g) => g.id))
      : [];

  return <GoalsClient goals={goals} plans={plans} />;
}
