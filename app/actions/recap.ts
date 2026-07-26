"use server";

import {
  revalidateRecapSurfaces,
  revalidateSocialSurfaces,
} from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { weekWindow } from "@/lib/dates";
import { computeWeekRecap } from "@/lib/db/recap";
import { getWeekLeaderboard } from "@/lib/db/leaderboard";

type Result = { ok: true } | { error: string };

// Max caption length on a posted recap.
const CAPTION_MAX = 280;

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

// Posts (or re-posts) the user's weekly recap to the friends feed. Computes the
// week's summary server-side — total tracked time, clocked rank among friends,
// and the top categories — and stores it denormalized on the recap_posts row so
// the feed card renders without recomputing. Upserts on (user_id, week_start_ms)
// so re-posting a week updates its caption/summary rather than duplicating.
export async function postRecap(
  weekStart: string,
  caption: string
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: "Invalid week" };

  const profile = await getProfile();
  const win = weekWindow(profile?.timezone ?? "UTC", weekStart);

  const [recap, leaderboard] = await Promise.all([
    computeWeekRecap(win.weekStartMs, win.weekEndMs),
    getWeekLeaderboard(win.weekStartMs, win.weekEndMs),
  ]);

  const me = leaderboard.find((r) => r.isMe);
  const categories = recap.categoryRows.slice(0, 4).map((c) => ({
    name: c.name,
    color: c.color,
    ms: c.ms,
  }));
  const trimmedCaption = caption.trim().slice(0, CAPTION_MAX) || null;

  const supabase = await createClient();
  const { error } = await supabase.from("recap_posts").upsert(
    {
      user_id: user.id,
      week_start_ms: win.weekStartMs,
      caption: trimmedCaption,
      total_tracked_ms: recap.totalTrackedMs,
      rank: me && leaderboard.length > 1 ? me.rank : null,
      circle_size: leaderboard.length,
      categories,
    },
    { onConflict: "user_id,week_start_ms" }
  );
  if (error) return { error: error.message };

  revalidateSocialSurfaces();
  return { ok: true };
}
