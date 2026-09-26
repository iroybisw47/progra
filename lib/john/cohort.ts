import { JOHN } from "@/lib/flags";

// Who is in the John instrumentation test.
//
// Two gates, deliberately orthogonal:
//
//   JOHN (build flag)        — "do the new columns exist?"  Flipping it is a
//                              redeploy, which is the kill switch.
//   profiles.john_enabled    — "is this person in the test?"  Flipping it is one
//                              UPDATE in the SQL editor, no deploy. That is what
//                              makes the cohort two people rather than 52.
//
// The column is guarded by guard_profiles_john_enabled, a copy of the seat_no
// guard: `authenticated` and `anon` cannot write it, so nobody enrols
// themselves. See .claude/plans/john-instrumentation.sql STEP 1.2.

// The shape every caller actually has — a Profile, or a row selected from it.
// Structural rather than importing Profile, so this file stays client-safe
// (lib/auth/profile.ts is `server-only`).
export type JohnProfile = { john_enabled?: boolean | null };

// The stored cohort bit on its own. Pure and flag-free so it is unit testable;
// call sites want isJohnUser() instead.
//
// Strict `=== true`: before the column SQL ran, PostgREST omitted the key
// entirely and this read `undefined`. Failing CLOSED is the only safe polarity
// here — the alternative silently shows new UI to all ~50 beta users.
export function johnCohortBit(profile: JohnProfile | null | undefined): boolean {
  return profile?.john_enabled === true;
}

// The gate every call site uses. Server components compute it once from
// getProfile() and pass it down as a plain `john` boolean prop — the new inputs
// are client components, and prop-drilling one boolean beats teaching them to
// read a profile.
export function isJohnUser(
  profile: JohnProfile | null | undefined
): boolean {
  return JOHN && johnCohortBit(profile);
}
