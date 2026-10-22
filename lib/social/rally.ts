// Rally: the shapes get_rally_state / send_rally hand back, and the copy the
// profile chip and sheet show. Pure and client-safe, like lib/social/nudges.ts,
// whose presets, lock reasons, refusal shape and cooldown formatting Rally
// reuses (.claude/plans/rally.md).
//
// Rally is Nudge reorganised around one choice. You pick Cheer or Nudge, then
// one target, then a preset:
//   * Cheer is for one habit a friend finished today, once they've clocked in.
//   * Nudge is for one open habit, one goal behind weekly pace, or their streak
//     when it's at risk.
// The database offers at most one of the two (rally_targets in rally.sql).

import {
  formatCooldownLeft,
  parseNudgeState,
  type NudgeRefusal,
  type NudgeState,
} from "@/lib/social/nudges";

export type RallyMode = "cheer" | "nudge";

// What a rally is about, as send_rally takes it and the nudges row stores it.
export type RallyKind = "habit" | "goal" | "streak";

export function isRallyKind(value: string): value is RallyKind {
  return value === "habit" || value === "goal" || value === "streak";
}

export type RallyHabit = { habitId: string; name: string; color: string | null };

// A goal behind its weekly pace, with the numbers the row's meta line shows.
// Both sums are over the friend's visible sessions only.
export type RallyGoal = {
  goalId: string;
  title: string;
  color: string | null;
  workedMs: number;
  quotaMs: number;
};

export type RallyNudge = {
  habits: RallyHabit[];
  goals: RallyGoal[];
  // Their shared streak, when nothing they've shared has counted today.
  streak: { current: number } | null;
};

// hidden / cooldown / locked mean exactly what they mean for the old chip.
// "ok" carries exactly one of cheer and nudge.
export type RallyState =
  | Exclude<NudgeState, { status: "ok" }>
  | { status: "ok"; cheer: { habits: RallyHabit[] } | null; nudge: RallyNudge | null };

export const RALLY_HIDDEN: RallyState = { status: "hidden" };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const asColor = (value: unknown) => (typeof value === "string" ? value : null);

function parseHabits(value: unknown): RallyHabit[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      const habit = asRecord(entry);
      if (!habit || typeof habit.habit_id !== "string" || typeof habit.name !== "string") {
        return null;
      }
      return { habitId: habit.habit_id, name: habit.name, color: asColor(habit.color) };
    })
    .filter((habit): habit is RallyHabit => habit !== null);
}

function parseGoals(value: unknown): RallyGoal[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      const goal = asRecord(entry);
      if (!goal || typeof goal.goal_id !== "string" || typeof goal.title !== "string") {
        return null;
      }
      const workedMs = goal.worked_ms;
      const quotaMs = goal.quota_ms;
      if (typeof workedMs !== "number" || typeof quotaMs !== "number" || quotaMs <= 0) {
        return null;
      }
      return {
        goalId: goal.goal_id,
        title: goal.title,
        color: asColor(goal.color),
        workedMs: Math.max(0, workedMs),
        quotaMs,
      };
    })
    .filter((goal): goal is RallyGoal => goal !== null);
}

// Defensive, like parseNudgeState: anything unrecognised hides the chip rather
// than offering something the database will refuse. Junk entries are dropped,
// an empty mode becomes null, and if both modes somehow arrive, Cheer wins,
// because that's the rule rally_targets enforces.
export function parseRallyState(json: unknown): RallyState {
  const row = asRecord(json);
  if (!row) return RALLY_HIDDEN;

  if (row.status === "cooldown" || row.status === "locked") {
    const state = parseNudgeState(json);
    return state.status === "ok" ? RALLY_HIDDEN : state;
  }
  if (row.status !== "ok") return RALLY_HIDDEN;

  const cheerHabits = parseHabits(asRecord(row.cheer)?.habits);
  const cheer = cheerHabits.length > 0 ? { habits: cheerHabits } : null;

  const nudgeRow = asRecord(row.nudge);
  let nudge: RallyNudge | null = null;
  if (nudgeRow) {
    const current = asRecord(nudgeRow.streak)?.current;
    const streak =
      typeof current === "number" && current > 0 ? { current: Math.floor(current) } : null;
    const habits = parseHabits(nudgeRow.habits);
    const goals = parseGoals(nudgeRow.goals);
    if (habits.length > 0 || goals.length > 0 || streak !== null) {
      nudge = { habits, goals, streak };
    }
  }

  if (cheer) return { status: "ok", cheer, nudge: null };
  if (nudge) return { status: "ok", cheer: null, nudge };
  return RALLY_HIDDEN;
}

// The refusal a non-ok chip stands for, or null when the chip can rally.
export function rallyStateRefusal(state: RallyState): NudgeRefusal | null {
  if (state.status === "cooldown") {
    return { reason: "cooldown", cooldownUntil: state.cooldownUntil, opensAt: null };
  }
  if (state.status === "locked") {
    return { reason: state.reason, cooldownUntil: null, opensAt: state.opensAt };
  }
  return null;
}

// Name-free copy for the server action, which knows only ids. The sheet
// re-renders it with the friend's name through rallyRefusalMessage.
//
// `disabled` covers both the Settings opt-out and a per-friend mute, and the
// words are chosen to be true of either: the sender must never learn which.
export function rallyRejectionFallback(refusal: NudgeRefusal): string {
  switch (refusal.reason) {
    case "cooldown":
      return "You've already rallied them recently.";
    case "disabled":
      return "They aren't taking rallies right now.";
    case "too_early":
      return "You can rally them from 9am their time.";
    case "in_session":
      return "They're in a session right now.";
    case "done_today":
      return "They're all caught up today.";
    case "nothing_to_nudge":
      return "They don't have any goals or habits yet.";
    case "unavailable":
      return "They can't be rallied right now.";
  }
}

// Why you can't rally {name}: the locked chip's tap, and a refused send's
// toast. `nowMs` is passed in so this stays pure.
export function rallyRefusalMessage(
  refusal: NudgeRefusal,
  name: string,
  nowMs: number
): string {
  switch (refusal.reason) {
    case "cooldown": {
      if (refusal.cooldownUntil === null) return `You've already rallied ${name} recently.`;
      const left = formatCooldownLeft(refusal.cooldownUntil, nowMs);
      return `You've already rallied ${name} — you can again in ${left}.`;
    }
    case "disabled":
      return `${name} isn't taking rallies right now.`;
    case "too_early": {
      if (refusal.opensAt === null) return `You can rally ${name} from 9am their time.`;
      const left = formatCooldownLeft(refusal.opensAt, nowMs);
      return `You can rally ${name} from 9am their time — in ${left}.`;
    }
    case "in_session":
      return `${name} is in a session right now.`;
    case "done_today":
      return `${name} is all caught up today.`;
    case "nothing_to_nudge":
      return `${name} doesn't have any goals or habits yet.`;
    case "unavailable":
      return `${name} can't be rallied right now.`;
  }
}

// "1.5h" / "5h" / "0h": one decimal, and none when it's whole.
function hours(ms: number): string {
  const h = Math.round((ms / 3_600_000) * 10) / 10;
  return `${h}h`;
}

// The meta line under a goal in the Nudge list: "1.5h of 5h this week".
export function goalPaceMeta(goal: Pick<RallyGoal, "workedMs" | "quotaMs">): string {
  return `${hours(goal.workedMs)} of ${hours(goal.quotaMs)} this week`;
}
