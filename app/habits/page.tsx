import { getProfile } from "@/lib/auth/profile";
import { getHabitsWithTodayStatus } from "@/lib/db/habits";
import { todayInTimeZone } from "@/lib/dates";

import { HabitsClient } from "./habits-client";

export default async function HabitsPage() {
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const todayLocal = todayInTimeZone(tz);

  const items = await getHabitsWithTodayStatus(todayLocal);

  return <HabitsClient items={items} todayLocal={todayLocal} />;
}
