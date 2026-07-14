import { listEventsInRange } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { listRecentSessions } from "@/lib/db/sessions";
import { getSessionPhotoUrls } from "@/lib/db/session-photos";
import { endOfWeek, startOfWeek } from "@/lib/dates";

import { ClockClient } from "./clock-client";

export default async function ClockPage() {
  // Fetch this week's events with a 1-day buffer on each side so any timezone
  // drift between server and client doesn't drop edge-day events.
  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const weekEnd = endOfWeek(now).getTime();
  const day = 24 * 60 * 60 * 1000;

  const [categories, sessions, goals] = await Promise.all([
    listCategories(),
    listRecentSessions(),
    listActiveGoals(),
  ]);
  // Events fetched after categories so categorization can run server-side.
  const events = await listEventsInRange(
    weekStart - day,
    weekEnd + day,
    categories
  );

  // Signed URL for the active session's "before" photo, if one was captured, so
  // the active card can show a thumbnail.
  const activeSession = sessions.find((s) => s.endedAt === null) ?? null;
  const activeBeforeUrl = activeSession?.beforePhotoPath
    ? (await getSessionPhotoUrls(activeSession)).before
    : null;

  return (
    <ClockClient
      categories={categories}
      sessions={sessions}
      events={events}
      goals={goals}
      activeBeforeUrl={activeBeforeUrl}
    />
  );
}
