// Greedy weekly placement. Pure module — no I/O. Takes goals + their plans +
// busy intervals + the week range + waking-window hours, returns proposed
// blocks. Spreads blocks across days (per-day count tiebreaker), picks the
// earliest fitting free slot, never overlaps busy events or already-placed
// blocks. NOT a solver — Step 4 may revisit.

import type { Goal } from "@/lib/db/goals";
import type { SessionPlan } from "@/lib/db/session-plans";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Tail-end-of-quota blocks shorter than this are dropped (no point creating
// a 12-minute "Goal time" block).
const MIN_REMAINDER_HOURS = 0.5;

type BusyInterval = { startMs: number; endMs: number };

export type PlacementInput = {
  goals: Goal[];
  plans: SessionPlan[];
  busy: BusyInterval[];
  weekStartMs: number; // start-of-week in local time, ms epoch
  weekEndMs: number; // end-of-week (inclusive moment of last ms)
  wakingStartHour: number; // 0..24, e.g. 8
  wakingEndHour: number; // 0..24, e.g. 23
};

export type ProposedBlock = {
  goalId: string;
  sessionPlanId: string | null;
  startMs: number;
  endMs: number;
  isFlex: boolean;
};

export type PlacementResult = {
  placed: ProposedBlock[];
  skipped: { goalId: string; sessionPlanId: string | null; reason: string }[];
};

type Slot = { startMs: number; endMs: number };

type QueuedBlock = {
  goalId: string;
  sessionPlanId: string | null;
  durationMs: number;
  // First-round blocks have roundIdx 0, second-round 1, etc — used to
  // round-robin across goals so no single goal monopolizes early slots.
  roundIdx: number;
  goalIdx: number;
};

// Subtract busy intervals from [rangeStart, rangeEnd] within a single day,
// returning free slots in chronological order.
function computeFreeSlots(
  rangeStart: number,
  rangeEnd: number,
  busy: BusyInterval[]
): Slot[] {
  if (rangeEnd <= rangeStart) return [];
  const clipped = busy
    .filter((b) => b.endMs > rangeStart && b.startMs < rangeEnd)
    .map((b) => ({
      startMs: Math.max(b.startMs, rangeStart),
      endMs: Math.min(b.endMs, rangeEnd),
    }))
    .sort((a, b) => a.startMs - b.startMs);

  const slots: Slot[] = [];
  let cursor = rangeStart;
  for (const b of clipped) {
    if (b.startMs > cursor) slots.push({ startMs: cursor, endMs: b.startMs });
    cursor = Math.max(cursor, b.endMs);
  }
  if (cursor < rangeEnd) slots.push({ startMs: cursor, endMs: rangeEnd });
  return slots;
}

// Per-day waking window. Uses local-time hour setting on the dayStart Date,
// matching the rest of the codebase's local-tz arithmetic (existing aggregate
// + dates module). DST drift on transition weeks is accepted for v1.
function wakingWindowForDay(
  dayStartMs: number,
  startHour: number,
  endHour: number
): { startMs: number; endMs: number } {
  const dayStartDate = new Date(dayStartMs);
  dayStartDate.setHours(0, 0, 0, 0);
  const base = dayStartDate.getTime();
  return {
    startMs: base + startHour * HOUR_MS,
    endMs: base + endHour * HOUR_MS,
  };
}

// Build the placement queue. For each goal: one block per planned (non-done)
// session_plan with duration = plan.targetHours. Sum vs goal.weeklyQuotaHours
// determines whether to add a leftover "Goal time" block (sessionPlanId=null).
function buildQueue(goals: Goal[], plans: SessionPlan[]): QueuedBlock[] {
  const perGoal = new Map<string, QueuedBlock[]>();

  goals.forEach((goal, goalIdx) => {
    const goalPlans = plans
      .filter((p) => p.goalId === goal.id && p.status === "planned")
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const blocks: QueuedBlock[] = goalPlans.map((p, i) => ({
      goalId: goal.id,
      sessionPlanId: p.id,
      durationMs: Math.max(0, p.targetHours) * HOUR_MS,
      roundIdx: i,
      goalIdx,
    }));

    const planTotalHours = goalPlans.reduce(
      (sum, p) => sum + Math.max(0, p.targetHours),
      0
    );
    const remainder = goal.weeklyQuotaHours - planTotalHours;
    if (remainder >= MIN_REMAINDER_HOURS) {
      blocks.push({
        goalId: goal.id,
        sessionPlanId: null,
        durationMs: remainder * HOUR_MS,
        roundIdx: blocks.length,
        goalIdx,
      });
    }
    perGoal.set(goal.id, blocks);
  });

  // Flatten with round-robin order: round 0 of goal A, round 0 of goal B, ...,
  // then round 1 of goal A, round 1 of goal B, etc. Goals with fewer blocks
  // simply drop out of later rounds.
  const out: QueuedBlock[] = [];
  goals.forEach((goal) => {
    for (const b of perGoal.get(goal.id) ?? []) out.push(b);
  });
  out.sort((a, b) => a.roundIdx - b.roundIdx || a.goalIdx - b.goalIdx);
  return out.filter((b) => b.durationMs > 0);
}

export function placeWeek(input: PlacementInput): PlacementResult {
  const { goals, plans, busy, weekStartMs, wakingStartHour, wakingEndHour } =
    input;

  // Per-day free slots, ordered chronologically.
  const freeByDay: Slot[][] = [];
  for (let d = 0; d < 7; d++) {
    const dayStartMs = weekStartMs + d * DAY_MS;
    const { startMs, endMs } = wakingWindowForDay(
      dayStartMs,
      wakingStartHour,
      wakingEndHour
    );
    freeByDay.push(computeFreeSlots(startMs, endMs, busy));
  }

  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const placed: ProposedBlock[] = [];
  const skipped: PlacementResult["skipped"] = [];

  const queue = buildQueue(goals, plans);

  for (const block of queue) {
    // Find the day with the fewest already-placed blocks that has any free
    // slot large enough. Break ties by earliest day-of-week.
    let bestDay = -1;
    for (let d = 0; d < 7; d++) {
      const fits = freeByDay[d].some(
        (s) => s.endMs - s.startMs >= block.durationMs
      );
      if (!fits) continue;
      if (bestDay < 0 || dayCounts[d] < dayCounts[bestDay]) bestDay = d;
    }
    if (bestDay < 0) {
      skipped.push({
        goalId: block.goalId,
        sessionPlanId: block.sessionPlanId,
        reason: "no free slot fits this duration",
      });
      continue;
    }

    // Earliest slot in chosen day that fits.
    const slots = freeByDay[bestDay];
    const slotIdx = slots.findIndex(
      (s) => s.endMs - s.startMs >= block.durationMs
    );
    const slot = slots[slotIdx];
    const startMs = slot.startMs;
    const endMs = startMs + block.durationMs;

    placed.push({
      goalId: block.goalId,
      sessionPlanId: block.sessionPlanId,
      startMs,
      endMs,
      isFlex: false,
    });

    // Shrink/remove the slot.
    if (endMs < slot.endMs) {
      slots[slotIdx] = { startMs: endMs, endMs: slot.endMs };
    } else {
      slots.splice(slotIdx, 1);
    }
    dayCounts[bestDay]++;
  }

  return { placed, skipped };
}
