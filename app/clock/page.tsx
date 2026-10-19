import { getProfile } from "@/lib/auth/profile";
import { isJohnUser } from "@/lib/john/cohort";
import { categorizeEvents, fetchEventsRaw } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { listRecentSessions } from "@/lib/db/sessions";
import { getSessionPhotoUrl } from "@/lib/db/session-photos";
import { endOfWeek, startOfWeek } from "@/lib/dates";
import { finishesOnboarding } from "@/lib/clock-handoff";
import { ONBOARDING_V3 } from "@/lib/flags";

import { ClockClient } from "./clock-client";
import { FinishOnboarding } from "./finish-onboarding";

export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; welcome?: string | string[] }>;
}) {
  // ?goal=<id> pre-selects that goal in the clock-in picker (tapped from the
  // Progress tab's "Goals today", and from onboarding v3's "Start session").
  // Inert while a session is active.
  //
  // ?welcome=1 is that "Start session" (lib/clock-handoff.ts): the Clock tab
  // below renders exactly as it does for anyone, and a leaf beside it stamps
  // onboarded_at (finish-onboarding.tsx says why here). Only with
  // ONBOARDING_V3 on and only while there's something to stamp; otherwise
  // the leaf isn't there and this page is the Clock tab as it always was.
  // (The arrival's Clock-in tap no longer asks for notifications: v3's own
  // notifications screen does, before the hand-off.)
  const { goal, welcome } = await searchParams;
  // The redesign runs the active session on the full-screen /clock/live timer,
  // but /clock stays reachable while tracking (minimize lands here) so you can
  // manage categories, add past sessions, and see the week — with a compact
  // live-timer strip pinned at the top (ClockClient). Clock-in still routes to
  // /clock/live; the strip taps back to it.

  // Fetch this week's events with a 1-day buffer on each side so any timezone
  // drift between server and client doesn't drop edge-day events.
  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const weekEnd = endOfWeek(now).getTime();
  const day = 24 * 60 * 60 * 1000;

  // One parallel wave — the raw event fetch no longer depends on categories
  // (categorization is applied in JS afterwards).
  const [categories, sessions, goals, rawEvents, profile] = await Promise.all([
    listCategories(),
    listRecentSessions(),
    listActiveGoals(),
    fetchEventsRaw(weekStart - day, weekEnd + day),
    // cache()-wrapped, already awaited by the root layout this render.
    getProfile(),
  ]);
  const events = categorizeEvents(rawEvents, categories);

  // Signed URL for the active session's photo, if one was captured, so the
  // active card can show a thumbnail.
  const activeSession = sessions.find((s) => s.endedAt === null) ?? null;
  const activePhotoUrl = activeSession
    ? await getSessionPhotoUrl(activeSession)
    : null;

  const finishing = finishesOnboarding({
    enabled: ONBOARDING_V3,
    welcome,
    onboarded: profile?.onboarded_at != null,
  });

  // The same shape with the leaf or without, so the stamp's re-render, which
  // drops it, can't remount the Clock under someone already using it.
  return (
    <>
      <ClockClient
        categories={categories}
        sessions={sessions}
        events={events}
        goals={goals}
        activePhotoUrl={activePhotoUrl}
        initialGoalId={goal ?? null}
        john={isJohnUser(profile)}
      />
      {finishing && <FinishOnboarding />}
    </>
  );
}
