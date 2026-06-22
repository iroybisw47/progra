import { listEventsInRange } from "@/lib/db/calendar-events";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { getActiveBlockAtTime } from "@/lib/db/scheduled-blocks";
import { listPlannableSessionPlans } from "@/lib/db/session-plans";
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

  const [categories, sessions, goals, plannablePlans, activeBlock] =
    await Promise.all([
      listCategories(),
      listRecentSessions(),
      listActiveGoals(),
      listPlannableSessionPlans(),
      getActiveBlockAtTime(Date.now()),
    ]);
  // Events fetched after categories so categorization can run server-side.
  const events = await listEventsInRange(
    weekStart - day,
    weekEnd + day,
    categories
  );

  // If the user is inside a scheduled block right now and that block has a
  // session_plan_id, pre-select that plan on clock-in. Goal-time blocks (no
  // plan) don't preselect anything — there's no UI to pick a goal directly.
  const preselectPlanId = activeBlock?.sessionPlanId ?? null;

  return (
    <ClockClient
      categories={categories}
      sessions={sessions}
      events={events}
      goals={goals}
      plans={plannablePlans}
      preselectPlanId={preselectPlanId}
    />
  );
}
