import { categorizeEvents, fetchEventsRaw } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { listRecentSessions } from "@/lib/db/sessions";
import { getSessionPhotoUrl } from "@/lib/db/session-photos";
import { endOfWeek, startOfWeek } from "@/lib/dates";

import { ClockClient } from "./clock-client";

export default async function ClockPage() {
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
  const [categories, sessions, goals, rawEvents] = await Promise.all([
    listCategories(),
    listRecentSessions(),
    listActiveGoals(),
    fetchEventsRaw(weekStart - day, weekEnd + day),
  ]);
  const events = categorizeEvents(rawEvents, categories);

  // Signed URL for the active session's photo, if one was captured, so the
  // active card can show a thumbnail.
  const activeSession = sessions.find((s) => s.endedAt === null) ?? null;
  const activePhotoUrl = activeSession
    ? await getSessionPhotoUrl(activeSession)
    : null;

  return (
    <ClockClient
      categories={categories}
      sessions={sessions}
      events={events}
      goals={goals}
      activePhotoUrl={activePhotoUrl}
    />
  );
}
