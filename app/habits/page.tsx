import { getProfile } from "@/lib/auth/profile";
import {
  listActiveHabits,
  listCompletionsInRange,
} from "@/lib/db/habits";
import { todayInTimeZone, weekRangeInTimeZone } from "@/lib/dates";

import { HabitsClient } from "./habits-client";

export default async function HabitsPage() {
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const todayLocal = todayInTimeZone(tz);
  const { startDate, endDate } = weekRangeInTimeZone(tz);

  const [habits, completions] = await Promise.all([
    listActiveHabits(),
    listCompletionsInRange(startDate, endDate),
  ]);

  return (
    <HabitsClient
      habits={habits}
      completions={completions}
      todayLocal={todayLocal}
      weekStart={startDate}
    />
  );
}
