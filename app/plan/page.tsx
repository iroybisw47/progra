import { listBusyTimes } from "@/lib/db/calendar-events";
import { listActiveGoals } from "@/lib/db/goals";
import { listPlansForGoals } from "@/lib/db/session-plans";
import { listBlocksInRange } from "@/lib/db/scheduled-blocks";
import { endOfWeek, startOfWeek } from "@/lib/dates";

import { PlanClient } from "./plan-client";

export default async function PlanPage() {
  const now = new Date();
  const weekStartMs = startOfWeek(now).getTime();
  const weekEndMs = endOfWeek(now).getTime();

  const [goals, blocks, busy] = await Promise.all([
    listActiveGoals(),
    listBlocksInRange(weekStartMs, weekEndMs),
    listBusyTimes(weekStartMs, weekEndMs),
  ]);
  const plans =
    goals.length > 0
      ? await listPlansForGoals(goals.map((g) => g.id))
      : [];

  return (
    <PlanClient
      weekStartMs={weekStartMs}
      weekEndMs={weekEndMs}
      goals={goals}
      plans={plans}
      blocks={blocks}
      busy={busy}
    />
  );
}
