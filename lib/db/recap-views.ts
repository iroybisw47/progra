import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

// Has the current user already opened the recap for the week starting at
// `weekStartMs` (the tz-correct Monday-00:00 epoch ms from weekWindow)? Drives
// the "your week is ready" nudge — once opened, a row exists and the nudge stays
// gone. RLS scopes recap_views to the owner; the explicit user_id filter is
// defense-in-depth (mirrors the other own-view reads). cache()'d so the Progress
// load and any sibling caller share one round-trip.
export const hasOpenedRecap = cache(
  async (weekStartMs: number): Promise<boolean> => {
    const user = await getCurrentUser();
    if (!user) return false;

    const supabase = await createClient();
    const { data } = await supabase
      .from("recap_views")
      .select("week_start_ms")
      .eq("user_id", user.id)
      .eq("week_start_ms", weekStartMs)
      .maybeSingle();
    return data !== null;
  }
);
