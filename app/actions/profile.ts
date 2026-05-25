"use server";

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
