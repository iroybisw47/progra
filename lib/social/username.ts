// Rules for public profile handles. Pure and dependency-free so the exact same
// checks run in three places: a unit test, the onboarding client (instant
// feedback as you type), and the setUsername server action (the authoritative
// gate). Mirrors the pure/tested approach of pwa-install.ts.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Handles that must never be claimed: the brand, app route names (profiles are
// linked by handle, and these read as system paths), and words that would
// impersonate a system account.
const RESERVED = new Set([
  "progra",
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "api",
  "auth",
  "login",
  "logout",
  "signin",
  "signout",
  "callback",
  "settings",
  "profile",
  "profiles",
  "account",
  "me",
  "user",
  "users",
  "about",
  "terms",
  "privacy",
  "legal",
  "contact",
  "onboarding",
  "clock",
  "goals",
  "habits",
  "recap",
  "history",
  "search",
  "home",
  "feed",
  "friends",
  "new",
  "edit",
  "null",
  "undefined",
  "anonymous",
]);

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; error: string };

// Canonical stored form: trimmed + lowercased. Handles are case-insensitive, so
// "Tapa" and "tapa" are the same person's claim on the same name.
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

// People search (searchUsers): the shortest query worth a round-trip, and the
// most rows one search returns. Five is the redesign's number (onboarding v3's
// find-friends screen and the v3 Friends tab, handoff README R:134): a short
// list that fits above the keyboard, where a longer one would scroll under it.
export const SEARCH_QUERY_MIN = 2;
export const SEARCH_RESULTS_MAX = 5;

// A search box's text as the search_users RPC should see it: normalized like a
// handle, minus any leading "@". People type "@maya" because that is how the
// app writes a handle everywhere, and no handle can contain "@" (checkUsername
// below), so the "@" can only ever stop a match. Trimmed again after the strip
// so "@ maya" searches for "maya", not " maya".
export function normalizeSearchQuery(input: string): string {
  return normalizeUsername(input).replace(/^@+/, "").trim();
}

// Search rows in match order, before searchUsers caps them at
// SEARCH_RESULTS_MAX: the handle exactly as typed, then handles that start with
// it, then everything else (a display-name match). Stable, so each group keeps
// the RPC's own order. This is SQL-2's ORDER BY done in the app, so the cap
// can't cut the person someone typed in full whichever search_users body is
// live. `q` is normalizeSearchQuery's output.
export function orderSearchMatches<T extends { username: string | null }>(
  rows: readonly T[],
  q: string
): T[] {
  const rank = (username: string | null): number => {
    const u = (username ?? "").toLowerCase();
    if (u === q) return 0;
    return u.startsWith(q) ? 1 : 2;
  };
  return rows
    .map((row, i) => ({ row, i, r: rank(row.username) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.row);
}

// What setUsername says when the unique index refuses a handle (23505): the
// one error a client can act on without a round-trip of its own, by showing
// it under the Username field instead of as a toast (onboarding v3's welcome,
// OWNER-FIX-3). Here rather than in the action because a "use server" file
// may only export async functions.
export const USERNAME_TAKEN_ERROR = "That username is taken.";

// Validates a raw input and returns the normalized handle on success. The DB's
// unique index is the final word on *availability* (see setUsername) — this
// only enforces shape and reserved words.
export function checkUsername(input: string): UsernameCheck {
  const username = normalizeUsername(input);

  if (username.length < USERNAME_MIN) {
    return {
      ok: false,
      error: `Username must be at least ${USERNAME_MIN} characters.`,
    };
  }
  if (username.length > USERNAME_MAX) {
    return {
      ok: false,
      error: `Username must be ${USERNAME_MAX} characters or fewer.`,
    };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return {
      ok: false,
      error: "Use only lowercase letters, numbers, and underscores.",
    };
  }
  if (!/[a-z]/.test(username)) {
    return { ok: false, error: "Username must contain at least one letter." };
  }
  if (username.startsWith("_") || username.endsWith("_")) {
    return {
      ok: false,
      error: "Username can't start or end with an underscore.",
    };
  }
  if (RESERVED.has(username)) {
    return { ok: false, error: "That username is reserved." };
  }
  return { ok: true, username };
}
