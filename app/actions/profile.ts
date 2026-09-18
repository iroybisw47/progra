"use server";

import { revalidatePath } from "next/cache";

import { getProfile } from "@/lib/auth/profile";
import {
  DEFAULT_CATEGORIES,
  SEEDED_SYSTEM_FILLS,
} from "@/lib/default-categories";
import {
  revalidateCalendarSurfaces,
  revalidateCategorySurfaces,
  revalidateIdentitySurfaces,
} from "@/lib/revalidate";
import { checkUsername } from "@/lib/social/username";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { requireSeat } from "@/lib/auth/require-seat";

// Account-level, unlike the per-device reminder prefs: the push is sent by the
// server, which knows accounts, not phones. Null = on, so the column's default
// state and a never-touched profile are the same thing.
export async function setSocialPushesEnabled(
  enabled: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ social_pushes_enabled: enabled })
    .eq("id", user.id);

  if (error) return { error: error.message };
  // Settings re-reads the profile for the row's initial state on next visit.
  revalidatePath("/settings");
  return { ok: true };
}

// Whether friends may nudge this user at all — not just whether it buzzes.
// With this off, `nudge_targets` hides the button and refuses the send, so no
// nudge is written and nothing reaches the notifications panel either. Default
// true, so it's an opt-OUT like social pushes; the column is NOT NULL so there
// is no null-means-on decoding here.
export async function setNudgesEnabled(
  enabled: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ nudges_enabled: enabled })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

// Opt-IN to research interview contact, set from onboarding's final screen and
// revocable in Settings. Unlike setSocialPushesEnabled above this is an opt-in,
// so there is no "null means yes" decoding anywhere — null and false are both
// "no" and the admin RPC filters on `is true`.
//
// Withdrawing clears the timestamp as well as the flag, so interview_consent_at
// can never describe a consent that no longer exists.
export async function setInterviewConsent(
  enabled: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const { error } = await supabase
    .from("profiles")
    .update({
      interview_consent: enabled,
      interview_consent_at: enabled ? new Date().toISOString() : null,
    })
    .eq("id", user.id);

  if (error) return { error: "Couldn't save that — try again." };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setProfileTimezone(
  timezone: string
): Promise<{ ok: true } | { error: string }> {
  if (!timezone || timezone.length > 100) {
    return { error: "Invalid timezone" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id);

  if (error) return { error: error.message };
  // A real timezone change shifts every day/week boundary in the app, so
  // re-render everything. Rare: EnsureProfileSync only calls this when the
  // browser tz differs from the stored one.
  revalidatePath("/", "layout");
  return { ok: true };
}

// Disconnect Google Calendar: best-effort revoke at Google, then clear the
// stored tokens + scope so every surface reads "not connected". Sync stops;
// already-mirrored calendar_events rows are untouched (history keeps working).
export async function disconnectGoogleCalendar(): Promise<
  { ok: true } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const profile = await getProfile();
  const refreshToken = profile?.google_provider_refresh_token;
  if (refreshToken) {
    // Best-effort: revoking at Google is a courtesy; a network failure must
    // not block the local disconnect (the user can also revoke from their
    // Google account page).
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch {
      // Ignore — local disconnect proceeds regardless.
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      google_provider_token: null,
      google_provider_refresh_token: null,
      google_token_expires_at: null,
      google_scopes: null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidateCalendarSurfaces();
  return { ok: true };
}

// Claims or updates the caller's public handle (social v2). Shape/reserved-word
// validation is shared with the onboarding client via checkUsername; the DB's
// unique index on profiles.username is the final authority on availability —
// two callers can pass validation for the same free name and race, so the
// unique violation is caught here and reported as "taken".
export async function setUsername(
  input: string
): Promise<{ ok: true; username: string } | { error: string }> {
  const check = checkUsername(input);
  if (!check.ok) return { error: check.error };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const { error } = await supabase
    .from("profiles")
    .update({ username: check.username })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation → the handle is already taken by someone else.
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: error.message };
  }
  revalidateIdentitySurfaces();
  return { ok: true, username: check.username };
}

// Updates the caller's public display name and/or bio (social v2 profile edit).
// The display_name/bio columns exist from Aspect 1; the handle is set separately
// via setUsername. Omit a field to leave it untouched.
export async function setProfileIdentity(input: {
  displayName?: string | null;
  bio?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const update: Record<string, unknown> = {};
  if (input.displayName !== undefined) {
    const dn = input.displayName?.trim() || null;
    if (dn && dn.length > 50) {
      return { error: "Display name must be 50 characters or fewer." };
    }
    update.display_name = dn;
  }
  if (input.bio !== undefined) {
    const b = input.bio?.trim() || null;
    if (b && b.length > 300) {
      return { error: "Bio must be 300 characters or fewer." };
    }
    update.bio = b;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidateIdentitySurfaces();
  return { ok: true };
}

// Stamps the first-run flow as finished; the Home gate stops redirecting to
// /onboarding once this is set. Write-once: the `.is(onboarded_at, null)` filter
// means only the *first* completion stamps a date — replaying onboarding and
// finishing again is a no-op, so the original join date is preserved (it feeds
// the "just joined" feed item, which must reflect the true first join).
export async function completeOnboarding(): Promise<
  { ok: true } | { error: string }
> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const { data, error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("onboarded_at", null)
    .select("id");

  if (error) return { error: error.message };

  // Only the FIRST completion seeds — `.select()` returns the stamped row, and
  // the write-once filter above means a replay matches nothing. A replayer has
  // had an account for a while; handing them four categories again (or
  // resurrecting ones they deleted) would be a surprise.
  if (data && data.length > 0) await seedDefaultCategories(user.id);

  revalidatePath("/");
  return { ok: true };
}

// Puts the four starter categories on a palette color. Two halves, because
// handle_new_user has usually already created them by the time this runs:
//
//   INSERT  a default the account doesn't have at all (case-insensitive match).
//   UPDATE  one that exists but still carries the off-palette hex that trigger
//           stamps — which renders as the neutral grey, indistinguishable from
//           the other three. See SEEDED_SYSTEM_FILLS.
//
// Never destructive. The update is gated on an exact match against the known
// system-default hex for that name, so a color the user picked themselves — or
// one a future trigger writes that we haven't measured — is left alone. Nothing
// here renames, and nothing recreates a category someone deleted.
//
// Errors are swallowed on purpose. Onboarding completing is the load-bearing
// part; a failed seed just leaves the categories where they already were.
async function seedDefaultCategories(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("categories")
    .select("id, name, color");
  if (readError) return;

  const byName = new Map(
    (existing ?? []).map((c: { id: string; name: string; color: string | null }) => [
      c.name.trim().toLowerCase(),
      c,
    ])
  );

  const missing: { user_id: string; name: string; color: string }[] = [];
  const recolor: { id: string; color: string }[] = [];

  for (const def of DEFAULT_CATEGORIES) {
    const key = def.name.toLowerCase();
    const row = byName.get(key);
    if (!row) {
      missing.push({ user_id: userId, name: def.name, color: def.color });
      continue;
    }
    const systemDefault = SEEDED_SYSTEM_FILLS[key];
    if (
      systemDefault &&
      row.color &&
      row.color.trim().toLowerCase() === systemDefault.toLowerCase()
    ) {
      recolor.push({ id: row.id, color: def.color });
    }
  }

  if (missing.length === 0 && recolor.length === 0) return;

  if (missing.length > 0) {
    const { error } = await supabase.from("categories").insert(missing);
    if (error) return;
  }
  // One statement per row: these are four rows at most, and a bulk upsert would
  // need the full row shape (name, rules) just to change one column.
  for (const r of recolor) {
    await supabase.from("categories").update({ color: r.color }).eq("id", r.id);
  }

  revalidateCategorySurfaces();
}

// Records "this person opened the app" for the admin analytics roster. Called
// by <LastSeenPing/> on first load and on every return to the foreground; the
// touch_last_seen RPC throttles to one write per 10 minutes and can only ever
// touch the caller's own row.
//
// Deliberately calls no revalidate*Surfaces() helper — the one exception to the
// mutation rule. Nothing any user sees reads last_seen_at, and revalidating on
// every app open would refetch the whole tree each time. The error is returned
// but the caller ignores it: a missing migration must not toast on every open.
export async function touchLastSeen(): Promise<
  { ok: true } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("touch_last_seen");
  if (error) return { error: "Couldn't record visit." };
  return { ok: true };
}
