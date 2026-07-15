import { notFound } from "next/navigation";
import Link from "next/link";
import { LockIcon, SettingsIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { Dashboard } from "@/components/dashboard";
import { GoalProgressBar } from "@/components/goal-progress";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { StoryCard } from "@/components/story-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { REDESIGN, SOCIAL_ENABLED } from "@/lib/flags";
import { listActiveGoalsForUser } from "@/lib/db/goals";
import {
  listActiveHabitsForUser,
  listCompletionsForUserInRange,
} from "@/lib/db/habits";
import { listRecentSessionsForUser } from "@/lib/db/sessions";
import { listProfileStories } from "@/lib/db/stories";
import { aggregateWeekByGoal } from "@/lib/aggregate";
import { todayInTimeZone, weekRangeInTimeZone } from "@/lib/dates";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

// The "You" tab. In V2 it's the identity-led own-profile (identity + this week's
// goal quotas + habits + photo stories), with a Settings entry point. In the
// pre-redesign social build it's the personal dashboard; in the beta it 404s.
export default async function MePage() {
  if (!SOCIAL_ENABLED) notFound();
  const user = await requireUser();

  if (!REDESIGN) {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    return <Dashboard email={user.email ?? ""} isAdmin={isAdmin === true} />;
  }

  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const { startDate, endDate } = weekRangeInTimeZone(tz);
  const today = todayInTimeZone(tz);
  const now = Date.now();

  const [goals, sessions, habits, completions, stories] = await Promise.all([
    listActiveGoalsForUser(user.id),
    listRecentSessionsForUser(user.id),
    listActiveHabitsForUser(user.id),
    listCompletionsForUserInRange(user.id, startDate, endDate),
    listProfileStories(user.id),
  ]);

  const goalWeekly = aggregateWeekByGoal(sessions, now);
  const goalBreakdown = goals
    .map((g) => ({
      id: g.id,
      title: g.title,
      quotaHours: g.weeklyQuotaHours,
      actualMs: goalWeekly.perGoal.get(g.id) ?? 0,
      isPrivate: g.isPrivate,
    }))
    .sort((a, b) => b.actualMs - a.actualMs);
  const weekTotalMs = goalBreakdown.reduce((s, r) => s + r.actualMs, 0);

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-28">
      <main className="flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold tracking-tight">You</h1>
          <Link
            href="/settings"
            aria-label="Settings"
            className="text-caption hover:text-ink flex size-9 items-center justify-center rounded-full border border-hairline"
          >
            <SettingsIcon className="size-4" />
          </Link>
        </header>

        {/* Identity */}
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AvatarInitials
              name={profile?.display_name ?? null}
              username={profile?.username ?? "?"}
              className="size-14 text-lg"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base font-bold">
                {profile?.display_name ||
                  (profile?.username ? `@${profile.username}` : "You")}
              </span>
              {profile?.username && (
                <span className="text-caption truncate text-sm">
                  @{profile.username}
                </span>
              )}
              {profile?.bio && (
                <span className="text-body mt-1 text-sm text-pretty">
                  {profile.bio}
                </span>
              )}
            </div>
            <Link
              href="/settings"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "ml-auto self-start",
              })}
            >
              Edit
            </Link>
          </CardContent>
        </Card>

        {/* Goal quotas */}
        {goalBreakdown.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold">Goal quotas</h2>
              <span className="text-caption font-mono text-xs tabular-nums">
                {formatHours(weekTotalMs)} this week
              </span>
            </div>
            <Card>
              <CardContent className="flex flex-col gap-4 py-4">
                {goalBreakdown.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{row.title}</span>
                      {row.isPrivate && (
                        <LockIcon
                          aria-label="Private"
                          className="text-caption size-3 shrink-0"
                        />
                      )}
                    </div>
                    <GoalProgressBar
                      quotaHours={row.quotaHours}
                      actualMs={row.actualMs}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Habits this week — compact M–S grid, checkmark per completed day. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Habits this week</h2>
          <Card>
            <CardContent className="py-4">
              <HabitWeekGrid
                habits={habits}
                completions={completions}
                weekStart={startDate}
                today={today}
              />
            </CardContent>
          </Card>
        </section>

        {/* Stories */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Stories</h2>
          {stories.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-caption text-center text-sm">
                  Sessions with a before and after photo show up here.
                </p>
              </CardContent>
            </Card>
          ) : (
            stories.map((story) => (
              <StoryCard key={story.sessionId} story={story} now={now} />
            ))
          )}
        </section>
      </main>
    </div>
  );
}
