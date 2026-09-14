// Nudge presets and the shapes the nudge RPCs hand back. Pure and client-safe,
// so the profile sheet, the notifications panel and the push sender all read
// one definition. Kept out of the "use server" action file, which may only
// export async functions.

// The five v1 messages. KEYED, not stored as text: the copy can be rewritten
// without a migration, and the nudges.preset_key CHECK constraint in the
// database encodes exactly these five keys — change one side and the other
// rejects the write (lib/social/nudges.test.ts pins them together).
//
// Tone is teammate, not supervisor: the person most likely to be nudged is the
// one already drifting, and "you haven't done your habits" reads as a scolding.
export const NUDGE_PRESETS = {
  lock_in: "Lock in 🔒",
  still_time: "Still time today 👀",
  waiting: "Your friends are waiting on you",
  one_session: "One session. That's it.",
  miss_you: "Feed's quiet without you",
} as const;

export type NudgePresetKey = keyof typeof NUDGE_PRESETS;

// Render order for the preset picker.
export const NUDGE_PRESET_KEYS = Object.keys(NUDGE_PRESETS) as NudgePresetKey[];

export function isNudgePreset(value: string): value is NudgePresetKey {
  return Object.prototype.hasOwnProperty.call(NUDGE_PRESETS, value);
}

export type NudgeTargetKind = "goal" | "habits";

export function isNudgeTargetKind(value: string): value is NudgeTargetKind {
  return value === "goal" || value === "habits";
}

export type NudgeGoalTarget = {
  goalId: string;
  title: string;
  color: string | null;
};

// What get_nudge_state returns, once parsed. "hidden" is the catch-all: the
// recipient isn't nudgeable and the button doesn't render. It deliberately
// carries NO reason — disabled, before 14:00, mid-session and "caught up" must
// be indistinguishable, or the button becomes a way to watch a friend's day.
export type NudgeState =
  | { status: "hidden" }
  | { status: "cooldown"; cooldownUntil: number }
  | {
      status: "ok";
      goals: NudgeGoalTarget[];
      habits: { left: number; total: number } | null;
    };

export const NUDGE_HIDDEN: NudgeState = { status: "hidden" };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

// Defensive on purpose: anything unrecognized collapses to hidden. The RPC is
// the authority on eligibility, so a shape this doesn't understand must hide
// the button rather than offer one that will be refused.
export function parseNudgeState(json: unknown): NudgeState {
  const row = asRecord(json);
  if (!row) return NUDGE_HIDDEN;

  if (row.status === "cooldown") {
    const until = asMs(row.cooldown_until);
    return until === null ? NUDGE_HIDDEN : { status: "cooldown", cooldownUntil: until };
  }

  if (row.status !== "ok") return NUDGE_HIDDEN;

  const goals: NudgeGoalTarget[] = (Array.isArray(row.goals) ? row.goals : [])
    .map((entry) => {
      const goal = asRecord(entry);
      if (!goal) return null;
      const goalId = goal.goal_id;
      const title = goal.title;
      if (typeof goalId !== "string" || typeof title !== "string") return null;
      return {
        goalId,
        title,
        color: typeof goal.color === "string" ? goal.color : null,
      };
    })
    .filter((goal): goal is NudgeGoalTarget => goal !== null);

  const habitsRow = asRecord(row.habits);
  const left = habitsRow?.left;
  const total = habitsRow?.total;
  const habits =
    typeof left === "number" && typeof total === "number" && left > 0
      ? { left, total }
      : null;

  // The RPC never returns "ok" with nothing to nudge, but if it somehow did,
  // an empty sheet is worse than no button.
  if (goals.length === 0 && habits === null) return NUDGE_HIDDEN;
  return { status: "ok", goals, habits };
}

export type NudgeRejection = "cooldown" | "in_session" | "unavailable";

export type SendNudgeResult =
  | { ok: true; nudgeId: string; pushed: boolean }
  | { ok: false; reason: NudgeRejection; cooldownUntil: number | null };

export function parseSendNudgeResult(json: unknown): SendNudgeResult {
  const row = asRecord(json);
  if (!row) return { ok: false, reason: "unavailable", cooldownUntil: null };

  if (row.ok === true && typeof row.nudge_id === "string") {
    return { ok: true, nudgeId: row.nudge_id, pushed: row.pushed === true };
  }

  const reason: NudgeRejection =
    row.reason === "cooldown" || row.reason === "in_session"
      ? row.reason
      : "unavailable";
  return { ok: false, reason, cooldownUntil: asMs(row.cooldown_until) };
}

// "4h" / "35m" / "a moment" — the wait left on a per-pair cooldown. `nowMs` is
// passed in rather than read, so this stays pure and testable.
export function formatCooldownLeft(untilMs: number, nowMs: number): string {
  const left = untilMs - nowMs;
  if (left <= 60_000) return "a moment";
  const minutes = Math.round(left / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

// Name-free copy for a refused send, for the server action — it knows only ids.
// The client re-renders this with the friend's actual name via
// nudgeRejectionMessage below.
export function nudgeRejectionFallback(
  result: Extract<SendNudgeResult, { ok: false }>
): string {
  if (result.reason === "cooldown") return "You've already nudged them recently.";
  if (result.reason === "in_session") return "They're in a session right now.";
  return "They can't be nudged right now.";
}

// Toast copy for a refused send. Every hidden-state rejection says the same
// vague thing, matching the RPC: the sender must not learn why.
export function nudgeRejectionMessage(
  result: Extract<SendNudgeResult, { ok: false }>,
  name: string,
  nowMs: number
): string {
  if (result.reason === "cooldown") {
    const left =
      result.cooldownUntil === null
        ? null
        : formatCooldownLeft(result.cooldownUntil, nowMs);
    return left === null
      ? `You've already nudged ${name} recently.`
      : `You've already nudged ${name} — you can again in ${left}.`;
  }
  if (result.reason === "in_session") return `${name} is in a session right now.`;
  return `${name} can't be nudged right now.`;
}
