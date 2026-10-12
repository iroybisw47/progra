import { RecapStoryV2 } from "@/components/recap-story/recap-story-v2";
import { getProfile } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/require-user";
import { weekWindow } from "@/lib/dates";
import { RECAP_V2 } from "@/lib/flags";
import { getWeekLeaderboard } from "@/lib/db/leaderboard";
import { computeWeekRecap } from "@/lib/db/recap";
import { isReviewMarkable, loadRecapStory } from "@/lib/db/recap-story";

import { RecapStory } from "./recap-story";

// The full-screen weekly recap story. Own-data only (RLS-scoped reads), derived
// from the live clock, so render per-request and never from a frozen cache entry.
export const dynamic = "force-dynamic";

export default async function RecapWeekPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  await requireUser();
  const { weekStart } = await params;

  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";

  // weekStart is a YYYY-MM-DD anchor; weekWindow snaps it to that week's Monday.
  // Anything that isn't a plain date string falls back to the current week — the
  // recap is a browse surface, not a strict data URL, so we never 404 here.
  const win = /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
    ? weekWindow(tz, weekStart)
    : weekWindow(tz);

  // The weekly review (RECAP_V2). The same story that opens by itself on
  // Progress, reached by its URL: closing it records the week as seen only once
  // its review is actually out (Monday 6am after it) — opening a week early here
  // mustn't swallow the auto-open that's coming.
  if (RECAP_V2) {
    const [view, markable] = await Promise.all([
      loadRecapStory(win.weekStartISO),
      isReviewMarkable(win.weekStartISO, win.weekStartMs),
    ]);
    return <RecapStoryV2 view={view} entry="link" markOnExit={markable} />;
  }

  const [recap, leaderboard] = await Promise.all([
    computeWeekRecap(win.weekStartMs, win.weekEndMs),
    getWeekLeaderboard(win.weekStartMs, win.weekEndMs),
  ]);

  return (
    <RecapStory
      recap={recap}
      weekStartISO={win.weekStartISO}
      leaderboard={leaderboard}
    />
  );
}
