import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import {
  aggregateWeek,
  aggregateWeekByGoal,
  buildCategoryBreakdown,
} from "@/lib/aggregate";
import { listCategories } from "@/lib/db/categories";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { listActiveGoals } from "@/lib/db/goals";
import { listActiveHabits, listCompletionsInRange } from "@/lib/db/habits";
import { computeMonthRollup } from "@/lib/db/rollups";
import { listRecentSessions } from "@/lib/db/sessions";
import { REDESIGN } from "@/lib/flags";
import {
  endOfWeek,
  formatRange,
  startOfWeek,
  todayInTimeZone,
  weekRangeInTimeZone,
} from "@/lib/dates";

import { OnboardingClient } from "./onboarding-client";
import { OnboardingClientV2 } from "./onboarding-client-v2";

const DAY_MS = 24 * 60 * 60 * 1000;

// First-run wizard. Fetches the same week snapshot Home renders so the tour
// steps show the user's REAL data — including the goal and practice session
// created moments earlier in the flow (client router.refresh()es after each
// mutation, so these props stay current between steps).
export default async function OnboardingPage() {
  await requireUser();

  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";

  // The redesign uses a leaner 5-step wizard (no spotlight tour), so it needs
  // only the goals to attribute the practice session and any in-flight session.
  if (REDESIGN) {
    const goals = await listActiveGoals();
    const sessions = await listRecentSessions();
    const active = sessions.find((s) => s.endedAt === null) ?? null;
    return (
      <OnboardingClientV2
        goals={goals}
        initialUsername={profile?.username ?? ""}
        activeSession={
          active
            ? { taskName: active.taskName, startedAt: active.startedAt }
            : null
        }
      />
    );
  }

  const { startDate, endDate } = weekRangeInTimeZone(tz);
  const today = todayInTimeZone(tz);

  const now = new Date();
  const weekStartMs = startOfWeek(now).getTime();
  const weekEndMs = endOfWeek(now).getTime();

  const [categories, sessions, habits, completions, goals, monthRollup] =
    await Promise.all([
      listCategories(),
      listRecentSessions(),
      listActiveHabits(),
      listCompletionsInRange(startDate, endDate),
      listActiveGoals(),
      // Current-month rollup for the History tour step — real numbers, and the
      // live Sync button's router.refresh() updates them mid-tour.
      computeMonthRollup(now),
    ]);
  const events = await listEventsInRange(
    weekStartMs - DAY_MS,
    weekEndMs + DAY_MS,
    categories
  );

  const weekly = aggregateWeek(sessions, events, now.getTime());
  const categoryBreakdown = buildCategoryBreakdown(
    weekly.perCategory,
    categories,
    goals
  );
  const goalWeekly = aggregateWeekByGoal(sessions, now.getTime());
  const goalBreakdown = goals
    .map((g) => ({
      id: g.id,
      title: g.title,
      quotaHours: g.weeklyQuotaHours,
      actualMs: goalWeekly.perGoal.get(g.id) ?? 0,
    }))
    .sort((a, b) => b.actualMs - a.actualMs);

  // A replay can start while a real session is still running — the practice
  // step adopts it instead of failing the one-active-session constraint.
  const active = sessions.find((s) => s.endedAt === null) ?? null;

  return (
    <OnboardingClient
      goals={goals}
      weeklyTotalMs={weekly.total}
      categoryBreakdown={categoryBreakdown}
      goalBreakdown={goalBreakdown}
      habits={habits}
      completions={completions}
      weekStart={startDate}
      today={today}
      weekRangeLabel={formatRange(startOfWeek(now), endOfWeek(now))}
      monthStartMs={monthRollup.startMs}
      monthTotalMs={monthRollup.totalTrackedMs}
      monthCategoryRows={monthRollup.categoryRows}
      monthUncategorizedCount={monthRollup.uncategorizedEventCount}
      activeSession={
        active
          ? {
              taskName: active.taskName,
              startedAt: active.startedAt,
            }
          : null
      }
      initialUsername={profile?.username ?? ""}
    />
  );
}
