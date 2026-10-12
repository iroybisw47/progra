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
    const { data, error } = await supabase
      .from("recap_views")
      .select("week_start_ms")
      .eq("user_id", user.id)
      .eq("week_start_ms", weekStartMs)
      .maybeSingle();
    // Fails CLOSED: a read error says "opened". The weekly review (RECAP_V2)
    // takes over the whole of Progress when this is false, so a blip must not
    // put it back in front of someone who already closed it.
    if (error) return true;
    return data !== null;
  }
);

// The first week with a weekly review (RECAP_V2) is the week of 2026-10-05.
// Its Monday starts, in every timezone (UTC−12 … UTC+14), between Oct 4 10:00
// and Oct 5 12:00 UTC, and the week before it started no later than Sep 28
// 12:00 UTC — so this instant splits "a review" from "an old recap" for every
// user whatever their zone. The old nudge was off from Oct 11, so no old-story
// open is recorded for a week at or past it.
const FIRST_REVIEW_WEEK_FLOOR_MS = Date.UTC(2026, 9, 4);

// Has this person ever closed a weekly review? Until they have, the story opens
// with its welcome slide. Fails CLOSED like hasOpenedRecap: an error answers
// "yes", so a blip costs the welcome rather than showing it every week.
export const hasClosedWeeklyReview = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return true;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recap_views")
    .select("week_start_ms")
    .eq("user_id", user.id)
    .gte("week_start_ms", FIRST_REVIEW_WEEK_FLOOR_MS)
    .limit(1);
  if (error) return true;
  return (data ?? []).length > 0;
});
