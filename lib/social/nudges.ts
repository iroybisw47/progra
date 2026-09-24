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
//
// The keys are frozen by that CHECK, so they no longer describe their copy
// (miss_you is now the slow-progress one). Rewording is free; renaming a key
// isn't.
// Past nudges render with the current copy — only the key is stored.
export const NUDGE_PRESETS = {
  lock_in: "Lock in",
  still_time: "Still got time today!",
  waiting: "Your friends are counting on you",
  one_session: "You can do this!",
  miss_you: "Slow progress is better than no progress",
} as const;

export type NudgePresetKey = keyof typeof NUDGE_PRESETS;

// The praise half. Same table, same CHECK constraint — the KEY carries the
// tone, which is why no column was added: a nudge and a cheer differ only in
// which preset was chosen. Keys are frozen by that CHECK exactly like the five
// above; reword freely, rename never.
//
// Tone is louder here on purpose. A prod has to stay gentle because it lands on
// someone already behind; congratulations have no such risk, and this is how the
// people using it actually text.
export const PRAISE_PRESETS = {
  lets_go: "LET'S GOOO 🔥",
  locked_in: "you're locked in 💪",
  goated: "goated behaviour 🐐",
} as const;

export type PraisePresetKey = keyof typeof PRAISE_PRESETS;

export const PRAISE_PRESET_KEYS = Object.keys(
  PRAISE_PRESETS
) as PraisePresetKey[];

export function isPraisePreset(value: string): value is PraisePresetKey {
  return Object.prototype.hasOwnProperty.call(PRAISE_PRESETS, value);
}

// Which half a stored preset_key belongs to. Mirrors is_praise_preset() in the
// database — that function is the authority; this is the client's copy, and
// lib/social/nudges.test.ts pins the two lists together.
export type NudgeTone = "nudge" | "praise";

export function toneOfPreset(value: string): NudgeTone {
  return isPraisePreset(value) ? "praise" : "nudge";
}

// The copy for any stored key, whichever half it came from. One lookup for the
// notifications panel and the admin report arm, which see keys, not tones.
export function presetCopy(value: string): string | null {
  if (isPraisePreset(value)) return PRAISE_PRESETS[value];
  if (isNudgePreset(value)) return NUDGE_PRESETS[value];
  return null;
}

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

// A goal worth congratulating this week. `band` mirrors statusForGoal() in
// lib/db/recap.ts — "hit" is at or past the weekly quota, "close" is the 75%
// band. "under" never reaches here.
export type NudgePraiseBand = "hit" | "close";

export type NudgePraiseGoal = NudgeGoalTarget & { band: NudgePraiseBand };

// What there is to celebrate. `habitsDone` is the TOTAL number of visible
// habits, present only when every one of them is done today; null otherwise.
export type NudgePraise = {
  habitsDone: number | null;
  goals: NudgePraiseGoal[];
};

// Why a friend can't be nudged right now. Shown to the sender when they tap the
// locked chip, so each must be safe to reveal: every one is computed by the RPC
// from the recipient's VISIBLE rows only, and a private session is ignored
// outright (a friend in one reads exactly as if they weren't clocked in).
//   unavailable       not onboarded, waitlisted, or no usable timezone
//   disabled          turned nudges off in Settings
//   too_early         before 09:00 their time (opensAt = when it opens)
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
      // The prod half — empty while a nudge cooldown is live, or mid-session.
      goals: NudgeGoalTarget[];
      habits: { left: number; total: number } | null;
      // The praise half — null while a praise cooldown is live. The two halves
      // have SEPARATE 6h cooldowns, so cheering someone never spends the nudge.
      praise: NudgePraise | null;
      praiseCooldownUntil: number | null;
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

  const praise = parsePraise(row.praise);

  // The RPC never returns "ok" with nothing at all, but if it somehow did, an
  // empty sheet is worse than no button. Praise counts as something.
  if (goals.length === 0 && habits === null && praise === null) {
    return NUDGE_HIDDEN;
  }
  return {
    status: "ok",
    goals,
    habits,
    praise,
    praiseCooldownUntil: asMs(row.praise_cooldown_until),
  };
}

// Same defensiveness as the goals list above: junk entries are dropped, and a
// praise block with nothing left in it becomes null rather than an empty sheet.
function parsePraise(value: unknown): NudgePraise | null {
  const row = asRecord(value);
  if (!row) return null;

  const habitsDone =
    typeof row.habits_done === "number" && row.habits_done > 0
      ? row.habits_done
      : null;

  const goals: NudgePraiseGoal[] = (Array.isArray(row.goals) ? row.goals : [])
    .map((entry) => {
      const goal = asRecord(entry);
      if (!goal) return null;
      const goalId = goal.goal_id;
      const title = goal.title;
      // An unrecognized band is dropped, not coerced: showing "hit" for
      // something that wasn't would be a lie about a friend's week.
      if (typeof goalId !== "string" || typeof title !== "string") return null;
      if (goal.band !== "hit" && goal.band !== "close") return null;
      return {
        goalId,
        title,
        color: typeof goal.color === "string" ? goal.color : null,
        band: goal.band,
      };
    })
    .filter((goal): goal is NudgePraiseGoal => goal !== null);

  if (habitsDone === null && goals.length === 0) return null;
  return { habitsDone, goals };
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
// a friend's 9am floor. `nowMs` is
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
      return "You can nudge them from 9am their time.";
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
      if (refusal.opensAt === null) return `You can nudge ${name} from 9am their time.`;
      const left = formatCooldownLeft(refusal.opensAt, nowMs);
      return `You can nudge ${name} from 9am their time — in ${left}.`;
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
