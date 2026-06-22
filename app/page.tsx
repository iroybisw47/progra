import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalProgressBar } from "@/components/goal-progress";
import { WeeklyHabits } from "@/components/weekly-habits";
import { aggregateWeek, aggregateWeekByGoal } from "@/lib/aggregate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { listCategories } from "@/lib/db/categories";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { listActiveGoals } from "@/lib/db/goals";
import { listActiveHabits, listCompletionsInRange } from "@/lib/db/habits";
import { listPlansForGoals } from "@/lib/db/session-plans";
import { listRecentSessions } from "@/lib/db/sessions";
import {
  endOfWeek,
  formatRange,
  startOfWeek,
  todayInTimeZone,
  weekRangeInTimeZone,
} from "@/lib/dates";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return <SignedOutLanding />;
  return <SignedInDashboard email={user.email ?? ""} />;
}

function SignedOutLanding() {
  return (
    <div className="flex flex-1 items-center justify-center px-5 pb-24">
      <main className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">
            Plan your week. Track deep work. See where your time goes.
          </p>
        </header>
        <Link
          href="/login"
          className={buttonVariants({ className: "h-11 w-full text-base" })}
        >
          Sign in with Google
        </Link>
      </main>
    </div>
  );
}

async function SignedInDashboard({ email }: { email: string }) {
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const { startDate, endDate } = weekRangeInTimeZone(tz);
  const today = todayInTimeZone(tz);

  const now = new Date();
  const weekStartMs = startOfWeek(now).getTime();
  const weekEndMs = endOfWeek(now).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const [categories, sessions, habits, completions, goals] = await Promise.all([
    listCategories(),
    listRecentSessions(),
    listActiveHabits(),
    listCompletionsInRange(startDate, endDate),
    listActiveGoals(),
  ]);
  // Events depend on categories for categorization, so fetch after.
  const events = await listEventsInRange(
    weekStartMs - dayMs,
    weekEndMs + dayMs,
    categories
  );
  const plans =
    goals.length > 0
      ? await listPlansForGoals(goals.map((g) => g.id))
      : [];

  const weekly = aggregateWeek(sessions, events, now.getTime());
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));
  const categoryBreakdown = Array.from(weekly.perCategory.entries())
    .map(([id, ms]) => ({
      id,
      name:
        id === null
          ? "Uncategorized"
          : categoryById.get(id)?.name ?? "Uncategorized",
      color: id === null ? null : categoryById.get(id)?.color ?? null,
      ms,
    }))
    .sort((a, b) => b.ms - a.ms);
  const maxCatMs = categoryBreakdown[0]?.ms ?? 0;

  // Goal progress reuses the same `now` so per-session attribution matches
  // the category bars above.
  const planToGoal = new Map(plans.map((p) => [p.id, p.goalId] as const));
  const goalWeekly = aggregateWeekByGoal(sessions, planToGoal, now.getTime());
  const goalBreakdown = goals
    .map((g) => ({
      id: g.id,
      title: g.title,
      quotaHours: g.weeklyQuotaHours,
      actualMs: goalWeekly.perGoal.get(g.id) ?? 0,
    }))
    .sort((a, b) => b.actualMs - a.actualMs);

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">
            Where your week is going.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Time this week</CardTitle>
            <CardDescription>
              {formatRange(startOfWeek(now), endOfWeek(now))}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="font-mono text-3xl tabular-nums">
              {formatHours(weekly.total)}
            </div>
            {categoryBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing logged yet this week.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {categoryBreakdown.map((row) => (
                  <div
                    key={row.id ?? "uncategorized"}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        {row.color && (
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                        )}
                        <span>{row.name}</span>
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {formatHours(row.ms)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary/60"
                        style={{
                          width:
                            maxCatMs > 0
                              ? `${Math.max(2, (row.ms / maxCatMs) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {goalBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Goals this week</CardTitle>
              <CardDescription>Committed vs actual</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {goalBreakdown.map((row) => (
                <GoalProgressBar
                  key={row.id}
                  title={row.title}
                  quotaHours={row.quotaHours}
                  actualMs={row.actualMs}
                />
              ))}
              {goalWeekly.untracked > 0 && (
                <p className="text-muted-foreground text-xs">
                  Untracked this week — {formatHours(goalWeekly.untracked)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <WeeklyHabits
          habits={habits}
          completions={completions}
          weekStart={startDate}
          today={today}
        />

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Signed in as
              </span>
              <span className="text-sm">{email}</span>
            </div>
            <form action="/auth/signout" method="post" className="w-full">
              <Button type="submit" variant="outline" className="h-10 w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
