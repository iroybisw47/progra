// Allowed values and field caps for the John instrumentation fields. Kept out of
// the "use server" action files (which may only export async functions) so the
// actions, the finish-screen card and the habit-miss card all agree.
//
// EVERY set here is mirrored by a DB CHECK constraint, and
// instrumentation.test.ts keeps a SECOND LITERAL COPY of each so editing one
// side fails in CI rather than as a failed insert in production. That is the
// lib/social/nudges.ts pattern, for the same reason.
//
// text + CHECK, never a Postgres enum: this database has none, and keys let the
// user-facing copy be rewritten without a migration.

// ---- Free text caps. Mirrored by sessions_intention_len / sessions_outcome_len
// ---- / goals_target_outcome_len. Enforced server-side with capText().
export const INTENTION_MAX = 140;
export const OUTCOME_MAX = 140;
export const TARGET_OUTCOME_MAX = 200;

// ---- Focus, 1-5. Mirrored by sessions_focus_rating_range.
export const FOCUS_RATINGS = [1, 2, 3, 4, 5] as const;
export type FocusRating = (typeof FOCUS_RATINGS)[number];

export function isFocusRating(v: unknown): v is FocusRating {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    (FOCUS_RATINGS as readonly number[]).includes(v)
  );
}

// ---- Phone distraction. Mirrored by sessions_phone_distraction_check.
// A stand-in for Screen Time data, which the app cannot read.
export const PHONE_LEVELS = ["none", "a_few", "a_lot"] as const;
export type PhoneLevel = (typeof PHONE_LEVELS)[number];

export const PHONE_LEVEL_LABELS: Record<PhoneLevel, string> = {
  none: "None",
  a_few: "A few",
  a_lot: "A lot",
};

export function isPhoneLevel(v: unknown): v is PhoneLevel {
  return typeof v === "string" && (PHONE_LEVELS as readonly string[]).includes(v);
}

// ---- Why a habit was missed. Mirrored by habit_misses_reason_check.
// Note the key is `didnt_feel_like_it` — no apostrophe, so it never needs
// escaping in SQL; the apostrophe lives in the label only.
export const MISS_REASONS = [
  "busy",
  "tired",
  "forgot",
  "didnt_feel_like_it",
] as const;
export type MissReason = (typeof MISS_REASONS)[number];

export const MISS_REASON_LABELS: Record<MissReason, string> = {
  busy: "Busy",
  tired: "Tired",
  forgot: "Forgot",
  didnt_feel_like_it: "Didn't feel like it",
};

export function isMissReason(v: unknown): v is MissReason {
  return typeof v === "string" && (MISS_REASONS as readonly string[]).includes(v);
}
