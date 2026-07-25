"use server";

import { revalidateRecapSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { weekWindow } from "@/lib/dates";

type Result = { ok: true } | { error: string };

// Records that the user has opened a given week's recap, so the "your week is
// ready" nudge on Progress stops showing. The client passes only the ISO Monday;
// the tz-correct epoch key is resolved here via weekWindow (the same source
// loadProgressData uses), so the stored week_start_ms always matches what the
// nudge checked against. Idempotent — re-opening a week is a no-op.
export async function markRecapOpened(weekStart: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: "Invalid week" };

  const profile = await getProfile();
  const { weekStartMs } = weekWindow(profile?.timezone ?? "UTC", weekStart);

  const supabase = await createClient();
  const { error } = await supabase
    .from("recap_views")
    .upsert(
      { user_id: user.id, week_start_ms: weekStartMs },
      { onConflict: "user_id,week_start_ms", ignoreDuplicates: true }
    );
  if (error) return { error: error.message };

  revalidateRecapSurfaces();
  return { ok: true };
}
