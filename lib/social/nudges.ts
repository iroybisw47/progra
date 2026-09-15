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

// Why a friend can't be nudged right now. Shown to the sender when they tap the
// locked chip, so each must be safe to reveal: every one is computed by the RPC
// from the recipient's VISIBLE rows only, and a private session is ignored
// outright (a friend in one reads exactly as if they weren't clocked in).
//   unavailable       not onboarded, waitlisted, or no usable timezone
//   disabled          turned nudges off in Settings
//   too_early         before 14:00 their time (opensAt = when it opens)
//   in_session        in a visible running session
//   done_today        every visible goal worked and every visible habit done
//   nothing_to_nudge  no visible goals or habits at all
export type NudgeLockReason =
  | "unavailable"
  | "disabled"
  | "too_early"
  | "in_session"
  | "done_today"
  | "nothing_to_nudge";

const LOCK_REASONS: readonly NudgeLockReason[] = [
  "unavailable",
  "disabled",
  "too_early",
  "in_session",
  "done_today",
  "nothing_to_nudge",
];

function asLockReason(value: unknown): NudgeLockReason {
  return LOCK_REASONS.find((reason) => reason === value) ?? "unavailable";
}

// What get_nudge_state returns, once parsed. "hidden" now means only "not a
// friend" (or self, or blocked) — no chip at all. A friend who can't be nudged
// right now is "locked", and the chip says why when tapped.
export type NudgeState =
  | { status: "hidden" }
  | { status: "cooldown"; cooldownUntil: number }
  | { status: "locked"; reason: NudgeLockReason; opensAt: number | null }
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

  if (row.status === "locked") {
    return { status: "locked", reason: asLockReason(row.reason), opensAt: asMs(row.opens_at) };
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

export type NudgeRejection = "cooldown" | NudgeLockReason;

// Why a nudge can't happen, with the times the copy needs. The same shape
// serves a refused send and a tap on the locked chip, so both say the same
// thing.
export type NudgeRefusal = {
  reason: NudgeRejection;
  cooldownUntil: number | null;
  opensAt: number | null;
};

export type SendNudgeResult =
  | { ok: true; nudgeId: string; pushed: boolean }
  | ({ ok: false } & NudgeRefusal);

export function parseSendNudgeResult(json: unknown): SendNudgeResult {
  const row = asRecord(json);
  if (!row) return { ok: false, reason: "unavailable", cooldownUntil: null, opensAt: null };

  if (row.ok === true && typeof row.nudge_id === "string") {
    return { ok: true, nudgeId: row.nudge_id, pushed: row.pushed === true };
  }

  return {
    ok: false,
    reason: row.reason === "cooldown" ? "cooldown" : asLockReason(row.reason),
    cooldownUntil: asMs(row.cooldown_until),
    opensAt: asMs(row.opens_at),
  };
}

// The refusal a non-ok chip stands for, or null when the chip can nudge.
export function nudgeStateRefusal(state: NudgeState): NudgeRefusal | null {
  if (state.status === "cooldown") {
    return { reason: "cooldown", cooldownUntil: state.cooldownUntil, opensAt: null };
  }
  if (state.status === "locked") {
    return { reason: state.reason, cooldownUntil: null, opensAt: state.opensAt };
  }
  return null;
}

// "4h" / "35m" / "a moment" — the wait left on a per-pair cooldown, or until
// a friend's 2pm floor. `nowMs` is
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
// nudgeRefusalMessage below.
export function nudgeRejectionFallback(refusal: NudgeRefusal): string {
  switch (refusal.reason) {
    case "cooldown":
      return "You've already nudged them recently.";
    case "disabled":
      return "They've turned off nudges.";
    case "too_early":
      return "You can nudge them from 2pm their time.";
    case "in_session":
      return "They're in a session right now.";
    case "done_today":
      return "They're all caught up today.";
    case "nothing_to_nudge":
      return "They don't have any goals or habits to nudge.";
    case "unavailable":
      return "They can't be nudged right now.";
  }
}

// Why you can't nudge {name}: the locked chip's tap, and a refused send's toast.
// `nowMs` is passed in so this stays pure.
export function nudgeRefusalMessage(
  refusal: NudgeRefusal,
  name: string,
  nowMs: number
): string {
  switch (refusal.reason) {
    case "cooldown": {
      if (refusal.cooldownUntil === null) return `You've already nudged ${name} recently.`;
      const left = formatCooldownLeft(refusal.cooldownUntil, nowMs);
      return `You've already nudged ${name} — you can again in ${left}.`;
    }
    case "disabled":
      return `${name} has turned off nudges.`;
    case "too_early": {
      if (refusal.opensAt === null) return `You can nudge ${name} from 2pm their time.`;
      const left = formatCooldownLeft(refusal.opensAt, nowMs);
      return `You can nudge ${name} from 2pm their time — in ${left}.`;
    }
    case "in_session":
      return `${name} is in a session right now.`;
    case "done_today":
      return `${name} is all caught up today.`;
    case "nothing_to_nudge":
      return `${name} doesn't have any goals or habits to nudge.`;
    case "unavailable":
      return `${name} can't be nudged right now.`;
  }
}
