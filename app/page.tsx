import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddToHomeHint } from "@/components/add-to-home-hint";
import { GoalProgressBar } from "@/components/goal-progress";
import { HomeActions } from "@/components/home-actions";
import { ReplayOnboardingButton } from "@/components/replay-onboarding-button";
import { WeekBreakdown } from "@/components/week-breakdown";
import { WeeklyHabits } from "@/components/weekly-habits";
import {
  aggregateWeek,
  aggregateWeekByGoal,
  buildCategoryBreakdown,
} from "@/lib/aggregate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { listCategories } from "@/lib/db/categories";
import { listEventsInRange } from "@/lib/db/calendar-events";
import { listActiveGoals } from "@/lib/db/goals";
import { listActiveHabits, listCompletionsInRange } from "@/lib/db/habits";
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

        <AddToHomeHint />
      </main>
    </div>
  );
}

async function SignedInDashboard({ email }: { email: string }) {
  const profile = await getProfile();
  // First-run gate: no completion stamp (or no profile row yet) → the wizard.
  // The OAuth callback lands new users here, so this is the only gate needed.
  if (!profile?.onboarded_at) redirect("/onboarding");
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
  const weekly = aggregateWeek(sessions, events, now.getTime());
  const categoryBreakdown = buildCategoryBreakdown(
    weekly.perCategory,
    categories,
    goals
  );

  // Goal progress reuses the same `now` so per-session attribution matches
  // the category bars above (goal clock-ins also surface as "Goal:" rows there).
  const goalWeekly = aggregateWeekByGoal(sessions, now.getTime());
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

        <Link href="/recap" className="block">
          <Card className="hover:bg-muted/30 transition-colors">
            <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">This week’s recap</p>
                <p className="text-muted-foreground text-xs">
                  A calm look at how the week is shaping up.
                </p>
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/history" className="block">
          <Card className="hover:bg-muted/30 transition-colors">
            <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">History</p>
                <p className="text-muted-foreground text-xs">
                  Time per goal across months and years.
                </p>
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </CardContent>
          </Card>
        </Link>

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
              <WeekBreakdown rows={categoryBreakdown} />
            )}
          </CardContent>
        </Card>

        {goalBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Goals this week</CardTitle>
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
            </CardContent>
          </Card>
        )}

        <WeeklyHabits
          habits={habits}
          completions={completions}
          weekStart={startDate}
          today={today}
        />

        {/* Calendar actions: short explanation + a small button each. Moved
            here from the Clock screen; sits just above the profile card. */}
        <HomeActions />

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
            <ReplayOnboardingButton />
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
