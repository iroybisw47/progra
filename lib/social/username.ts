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
