import type { Profile } from "@/lib/auth/profile";

// Deliberately NOT `server-only` and deliberately type-only in its imports:
// the predicate is pure, so it stays unit-testable (vitest covers `lib/**`).
// The server-side `requireSeat()` action guard lives in `require-seat.ts`.

// The 250-user beta cap. A seat is claimed in the DB at signup; this reads the
// outcome.
//
// Strict `=== null` is load-bearing. `null` means "the column exists and this
// user has no seat" — genuinely waitlisted. `undefined` means the column isn't
// deployed yet (PostgREST omits absent keys), which must NOT be read as
// waitlisted: if the app ever ships ahead of the hand-run SQL, every user would
// be locked out of their own account. Missing column → everyone stays in.
export function isWaitlisted(
  profile: Pick<Profile, "seat_no"> | null,
): boolean {
  return profile != null && profile.seat_no === null;
}
