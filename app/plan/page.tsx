import { sweepPastBlocks } from "@/app/actions/scheduled-blocks";
import { listBusyTimes } from "@/lib/db/calendar-events";
import { getGoalsByIds, listActiveGoals } from "@/lib/db/goals";
import { listPlansForGoals } from "@/lib/db/session-plans";
import {
  listBlocksInRange,
  listMissedNeedingReslot,
} from "@/lib/db/scheduled-blocks";
import { proposeReslotSlots } from "@/lib/placement";
import { endOfWeek, startOfWeek } from "@/lib/dates";

import { PlanClient } from "./plan-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const RESLOT_LOOKBACK_DAYS = 14;

export default async function PlanPage() {
  // Lazy miss-detection. PWAs have no background jobs, so the sweep runs
  // every time a planning surface loads. Cheap: scoped to ~2 weeks back.
  await sweepPastBlocks();

  const now = new Date();
  const nowMs = now.getTime();
  const weekStartMs = startOfWeek(now).getTime();
  const weekEndMs = endOfWeek(now).getTime();
  const sinceMs = nowMs - RESLOT_LOOKBACK_DAYS * DAY_MS;

  const [goals, blocks, busy, missedBlocks] = await Promise.all([
    listActiveGoals(),
    listBlocksInRange(weekStartMs, weekEndMs),
    listBusyTimes(weekStartMs, weekEndMs),
    listMissedNeedingReslot(sinceMs),
  ]);

  // Missed blocks may reference goals the user has since archived. Backfill
  // titles so the surface doesn't render "Untitled".
  const missedGoalIds = [...new Set(missedBlocks.map((b) => b.goalId))];
  const activeIds = new Set(goals.map((g) => g.id));
  const orphanGoalIds = missedGoalIds.filter((id) => !activeIds.has(id));
  const orphanGoals =
    orphanGoalIds.length > 0 ? await getGoalsByIds(orphanGoalIds) : [];

  // Plans for active + orphan goals so the missed-block surface and the
  // scheduled-block labels can both look up plan titles even if archived.
  const allRelevantGoalIds = [
    ...new Set([
      ...goals.map((g) => g.id),
      ...orphanGoals.map((g) => g.id),
    ]),
  ];
  const plans =
    allRelevantGoalIds.length > 0
      ? await listPlansForGoals(allRelevantGoalIds)
      : [];

  // Suggestion obstacles: real calendar events + still-scheduled blocks in
  // the rest of this week. Missed/moved/done blocks are past or replaced.
  const scheduledObstacles = blocks
    .filter((b) => b.status === "scheduled")
    .map((b) => ({
      id: b.id,
      title: null,
      startMs: b.startMs,
      endMs: b.endMs,
    }));

  const goalById = new Map(
    [...goals, ...orphanGoals].map((g) => [g.id, g] as const)
  );
  const planById = new Map(plans.map((p) => [p.id, p] as const));

  const missedItems = missedBlocks.map((mb) => {
    const goal = goalById.get(mb.goalId);
    const plan = mb.sessionPlanId ? planById.get(mb.sessionPlanId) : null;
    const suggestions = proposeReslotSlots(
      { startMs: mb.startMs, endMs: mb.endMs },
      busy,
      scheduledObstacles,
      nowMs,
      weekEndMs,
      8,
      23,
      3
    );
    return {
      block: mb,
      goalTitle: goal?.title ?? "Untitled goal",
      planTitle: plan?.title ?? null,
      suggestions,
    };
  });

  return (
    <PlanClient
      weekStartMs={weekStartMs}
      weekEndMs={weekEndMs}
      goals={goals}
      plans={plans}
      blocks={blocks}
      busy={busy}
      missedItems={missedItems}
    />
  );
}
