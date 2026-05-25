import { listEventsInRange } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";

import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  // Window matches the sync window roughly: 30 days back, 60 days forward.
  // Client filters down to the selected day.
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const start = now - 30 * day;
  const end = now + 60 * day;

  const categories = await listCategories();
  const events = await listEventsInRange(start, end, categories);

  return <CalendarClient events={events} categories={categories} />;
}
