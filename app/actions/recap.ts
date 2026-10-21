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
import { requireSeat } from "@/lib/auth/require-seat";
import { loadReviewPost } from "@/lib/db/recap-story";
import { getMyRecapPostForWeek } from "@/lib/db/weekly-reviews";
import { RECAP_V2 } from "@/lib/flags";
import { normalizeFill } from "@/lib/palette";
import { normalizeCaption, reviewPostRow } from "@/lib/weekly-review";

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
  const seat = await requireSeat();
  if ("error" in seat) return seat;
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
    // Stored as hex: a goal row's color arrives as var(--palette-N), the
    // display form, which nothing reading the row back could resolve.
    color: normalizeFill(c.color) ?? c.color,
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

// Posts (or re-posts) the week from the weekly review's Share slide (RECAP_V2):
// hours tracked, % towards goals and % of habits done, plus an optional
// caption. Every number is recomputed here from the same reads and rules as
// the story (loadReviewPost); the client sends only the week and the caption.
// Refused for a week whose review isn't out yet. A re-post (a caption edit)
// upserts and keeps created_at, so it doesn't jump up the feed. Errors are
// generic: the DB's own text never reaches the client.
export async function postWeeklyReview(
  weekStart: string,
  caption: string
): Promise<{ ok: true; recapId: string; edited: boolean } | { error: string }> {
  const failed = { error: "Couldn't post your week. Try again." };
  if (!RECAP_V2) return failed;
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: "Invalid week" };
  const normalized = normalizeCaption(caption);
  if ("error" in normalized) return normalized;

  let post: Awaited<ReturnType<typeof loadReviewPost>>;
  try {
    post = await loadReviewPost(weekStart);
  } catch {
    return failed;
  }
  if (!post) return { error: "This week can't be posted yet." };

  const existing = await getMyRecapPostForWeek(post.weekStartMs);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recap_posts")
    .upsert(reviewPostRow(post.summary, post.extras, user.id, post.weekStartMs, normalized.caption), {
      onConflict: "user_id,week_start_ms",
    })
    .select("id")
    .single();
  if (error || !data) return failed;

  revalidateSocialSurfaces();
  return { ok: true, recapId: (data as { id: string }).id, edited: existing !== null };
}
