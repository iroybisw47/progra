"use server";

import { revalidatePath } from "next/cache";

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
