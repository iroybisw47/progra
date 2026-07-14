"use server";

import { revalidatePath } from "next/cache";

import { checkUsername } from "@/lib/social/username";
import { createClient } from "@/lib/supabase/server";

export async function setProfileTimezone(
  timezone: string
): Promise<{ ok: true } | { error: string }> {
  if (!timezone || timezone.length > 100) {
    return { error: "Invalid timezone" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id);

  if (error) return { error: error.message };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ username: check.username })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation → the handle is already taken by someone else.
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: error.message };
  }
  revalidatePath("/");
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  revalidatePath("/profile/[username]", "page");
  return { ok: true };
}

// Stamps the first-run flow as finished; the Home gate stops redirecting to
// /onboarding once this is set.
export async function completeOnboarding(): Promise<
  { ok: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

// Re-test switch: clears the stamp so the next Home load re-enters the real
// onboarding flow end-to-end.
export async function replayOnboarding(): Promise<
  { ok: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: null })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}
