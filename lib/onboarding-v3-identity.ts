// Onboarding v3's Screen 1, the welcome (.claude/plans/onboarding-v3.md,
// OWNER-FIX-3): v2's welcome screen as it's live today, run inside the v3
// shell. The parts that can be wrong without a device live here: when the
// handle lets Continue through (v2's rules, checkUsername alone), what a
// failed save means, where Continue goes once the identity is saved, and
// which writes it makes. Pure. The screen (app/onboarding/v3/welcome-screen.tsx)
// owns the state and the network.
//
// The live handle check (debounced availability, suggestions from the name,
// alternatives under a taken handle) went with OWNER-FIX-3: the owner asked
// for the welcome screen that's live today, and its handle is checked for
// shape as you type and for availability only by setUsername on Continue,
// whose unique index has the final word (the 23505 path).

import type { ItemPhase } from "@/lib/motion";
import type { WizardState } from "@/lib/onboarding-v3";
import type { OnboardingV3Services } from "@/lib/onboarding-v3-services";
import { USERNAME_TAKEN_ERROR, checkUsername, normalizeUsername } from "@/lib/social/username";

// ---- The handle ---------------------------------------------------------------

// The handle as the welcome reads it, after every keystroke. v2's rule,
// exactly (onboarding-client-v2.tsx): empty is no handle and no error; any
// other text is checkUsername's call, its own message when it refuses. The
// name is optional and plays no part.
//
// One addition: `taken`, the handle setUsername last refused as taken. While
// the field still holds it, it's invalid with setUsername's own words, which
// the screen shows under Username (v2's error slot), so Continue can't send
// the same refused handle again. Any edit to the field clears it.
export type WelcomeHandle =
  | { valid: true; username: string; error: null }
  | { valid: false; username: null; error: string | null };

export function welcomeHandle(raw: string, taken: string | null = null): WelcomeHandle {
  if (!raw.trim()) return { valid: false, username: null, error: null };
  const check = checkUsername(raw);
  if (!check.ok) return { valid: false, username: null, error: check.error };
  if (taken !== null && check.username === normalizeUsername(taken)) {
    return { valid: false, username: null, error: USERNAME_TAKEN_ERROR };
  }
  return { valid: true, username: check.username, error: null };
}

// What a setUsername failure means for the welcome: "taken" is the 23505 path,
// shown under Username as v2's error and remembered (welcomeHandle's `taken`);
// anything else is toasted.
export function usernameFailure(error: string): "taken" | "other" {
  return error === USERNAME_TAKEN_ERROR ? "taken" : "other";
}

// ---- Continue -----------------------------------------------------------------

// The welcome's Continue (the CTA, or Return in the username field):
//   ignore  the handle isn't valid yet, or a save is already in flight
//   save    write what changed (identityWrites), and once that lands, open the
//           UW sheet over the welcome when UW is on, or go to Screen 2 when
//           it's off. The sheet then decides when Screen 2 comes (its No,
//           Skip or Continue).
// With UW on it opens the sheet every time, a second Continue included, so
// Back from Screen 2 and on again shows the answer as it was left.
export type WelcomeNext = "uwSheet" | "goal";
export type WelcomeContinue = { kind: "ignore" } | { kind: "save"; then: WelcomeNext };

export function welcomeContinue({
  uwEnabled,
  valid,
  saving,
}: {
  uwEnabled: boolean;
  valid: boolean;
  saving: boolean;
}): WelcomeContinue {
  if (!valid || saving) return { kind: "ignore" };
  return { kind: "save", then: uwEnabled ? "uwSheet" : "goal" };
}

// ---- Writes -------------------------------------------------------------------

export type SavedIdentity = { username: string; displayName: string | null };

// What Continue has to write, given what's already saved: a handle only if it
// changed, a display name only if it changed. Nothing at all for a replayer
// who changed nothing, and nothing twice for someone who goes Back and
// Continues again. `displayName` is undefined when it needs no write; null is
// a real value, "clear it", since the name is optional (v2's rule): a
// replayer who empties theirs has it cleared, as v2's save would.
export function identityWrites(
  saved: SavedIdentity,
  next: { username: string; name: string }
): { username: string | null; displayName: string | null | undefined } {
  const username = normalizeUsername(next.username);
  const displayName = next.name.trim() || null;
  return {
    username: username && username !== normalizeUsername(saved.username) ? username : null,
    displayName: displayName === (saved.displayName?.trim() || null) ? undefined : displayName,
  };
}

// The toast for a save that never got an answer (a dropped connection).
export const IDENTITY_SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

// What a save of identityWrites' writes came to, with what's saved after it,
// however far it got. The handle is written first, so a name that fails after
// it leaves the new handle saved, and the retry writes the name alone.
//   saved   everything written
//   taken   setUsername refused the handle as taken (the 23505 path), which
//           the welcome shows under Username (welcomeHandle's `taken`).
//           Nothing else is written.
//   failed  any other refusal, or no answer at all: toasted, and Continue
//           stays on the welcome
export type IdentitySave =
  | { kind: "saved"; saved: SavedIdentity }
  | { kind: "taken"; saved: SavedIdentity; handle: string }
  | { kind: "failed"; saved: SavedIdentity; error: string };

// Never rejects: a call that throws (a dropped connection) is "failed".
export async function saveIdentity(
  services: Pick<OnboardingV3Services, "setUsername" | "setProfileIdentity">,
  saved: SavedIdentity,
  writes: { username: string | null; displayName: string | null | undefined }
): Promise<IdentitySave> {
  let now = saved;
  try {
    if (writes.username !== null) {
      const r = await services.setUsername(writes.username);
      if ("error" in r) {
        return usernameFailure(r.error) === "taken"
          ? { kind: "taken", saved: now, handle: writes.username }
          : { kind: "failed", saved: now, error: r.error };
      }
      now = { ...now, username: r.username };
    }
    if (writes.displayName !== undefined) {
      const r = await services.setProfileIdentity({ displayName: writes.displayName });
      if ("error" in r) return { kind: "failed", saved: now, error: r.error };
      now = { ...now, displayName: writes.displayName };
    }
    return { kind: "saved", saved: now };
  } catch {
    return { kind: "failed", saved: now, error: IDENTITY_SAVE_FAILED };
  }
}

// What the rest of the wizard shows of the welcome (the top row's avatar, the
// intro's sample post): the name and handle as Continue last saved them, not
// as they're being typed, so a keystroke re-renders the welcome alone. Both
// only show from Screen 2, by which point the two are the same. The avatar's
// palette color is keyed by the handle as it's stored.
export type WelcomeShown = { displayName: string; colorKey: string };

export function welcomeShown(displayName: string | null, username: string): WelcomeShown {
  return {
    displayName: (displayName ?? "").trim(),
    colorKey: normalizeUsername(username) || "?",
  };
}

// ---- Screens ------------------------------------------------------------------

// Where screen `index` stands while `current` is showing: its items rest
// "past" (exited upward) once you've moved on, and "ahead" (waiting below)
// until you reach it or after you go back from it (lib/motion.ts itemStyle).
export function phaseFor(index: number, current: WizardState["screen"]): ItemPhase {
  if (index === current) return "active";
  return index < current ? "past" : "ahead";
}
