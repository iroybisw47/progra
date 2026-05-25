import { listEventsInRange } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listRecentSessions } from "@/lib/db/sessions";
import { endOfWeek, startOfWeek } from "@/lib/dates";

import { ClockClient } from "./clock-client";

export default async function ClockPage() {
  // Fetch this week's events with a 1-day buffer on each side so any timezone
  // drift between server and client doesn't drop edge-day events.
  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const weekEnd = endOfWeek(now).getTime();
  const day = 24 * 60 * 60 * 1000;

  const [categories, sessions] = await Promise.all([
    listCategories(),
    listRecentSessions(),
  ]);
  // Events fetched after categories so categorization can run server-side.
  const events = await listEventsInRange(
    weekStart - day,
    weekEnd + day,
    categories
  );

  return (
    <ClockClient
      categories={categories}
      sessions={sessions}
      events={events}
    />
  );
}
