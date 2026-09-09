// Joins the two name halves Sign in with Apple hands over.
//
// Pure and separately testable because the interesting cases are all
// unreachable from a signed-in device: Apple returns these ONLY on the very
// first authorization for an Apple ID + app pair, so re-testing by hand means
// revoking the app under Settings → Sign-In & Security each time.
//
// Both halves are independently nullable — a user can grant one and withhold
// the other — so this filters before joining rather than assuming a pair, and
// returns undefined rather than an empty string so callers can treat "no name"
// as "leave the column alone".
export function appleDisplayName(
  givenName: string | null | undefined,
  familyName: string | null | undefined
): string | undefined {
  const name = [givenName, familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" ");

  return name || undefined;
}
