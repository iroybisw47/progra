import { startOfWeek, parseLocalDate } from "@/lib/dates";
import { computeWeekRecap } from "@/lib/db/recap";

import { RecapClient } from "./recap-client";

const DAY_MS = 24 * 60 * 60 * 1000;

type SearchParams = Promise<{ w?: string }>;

export default async function RecapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const now = new Date();
  const todayWeekStart = startOfWeek(now);

  // ?w=YYYY-MM-DD anchors the recap to that week. Invalid input falls back
  // to the current week silently rather than 404'ing — the recap is a
  // browse surface, not a strict data URL.
  let anchor = todayWeekStart;
  if (params.w && /^\d{4}-\d{2}-\d{2}$/.test(params.w)) {
    const parsed = parseLocalDate(params.w);
    if (!Number.isNaN(parsed.getTime())) anchor = parsed;
  }

  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const recap = await computeWeekRecap(weekStart.getTime(), weekEnd.getTime());

  const isCurrentWeek =
    weekStart.getTime() === todayWeekStart.getTime();
  const isFutureWeek = weekStart.getTime() > todayWeekStart.getTime();

  const prevAnchor = new Date(weekStart.getTime() - 7 * DAY_MS);
  const nextAnchor = new Date(weekStart.getTime() + 7 * DAY_MS);

  return (
    <RecapClient
      recap={recap}
      isCurrentWeek={isCurrentWeek}
      isFutureWeek={isFutureWeek}
      prevWeekParam={formatYmd(prevAnchor)}
      nextWeekParam={formatYmd(nextAnchor)}
    />
  );
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
