import { getProfile } from "@/lib/auth/profile";
import {
  addDaysISO,
  mondayOfDateISO,
  todayInTimeZone,
  zonedDayStartMs,
} from "@/lib/dates";
import { computeWeekRecap } from "@/lib/db/recap";

import { RecapClient } from "./recap-client";

type SearchParams = Promise<{ w?: string }>;

export default async function RecapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  // Week boundaries are computed in the user's stored timezone (the same
  // source the habits flow trusts). Server-local time is UTC on Vercel, so
  // the old `startOfWeek(new Date())` approach started the "week" on Sunday
  // evening for anyone west of UTC.
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";

  const currentMonday = mondayOfDateISO(todayInTimeZone(tz));

  // ?w=YYYY-MM-DD anchors the recap to that week. Invalid input falls back
  // to the current week silently rather than 404'ing — the recap is a
  // browse surface, not a strict data URL.
  let monday = currentMonday;
  if (params.w && /^\d{4}-\d{2}-\d{2}$/.test(params.w)) {
    monday = mondayOfDateISO(params.w);
  }

  // Monday 00:00 through Sunday 23:59:59.999, both in the user's tz.
  const weekStartMs = zonedDayStartMs(monday, tz);
  const weekEndMs = zonedDayStartMs(addDaysISO(monday, 7), tz) - 1;

  const recap = await computeWeekRecap(weekStartMs, weekEndMs);

  return (
    <RecapClient
      recap={recap}
      isCurrentWeek={monday === currentMonday}
      isFutureWeek={monday > currentMonday}
      prevWeekParam={addDaysISO(monday, -7)}
      nextWeekParam={addDaysISO(monday, 7)}
    />
  );
}
