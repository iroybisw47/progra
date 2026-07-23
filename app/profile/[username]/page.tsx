import { notFound } from "next/navigation";
import { LockIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { GoalProgressBar } from "@/components/goal-progress";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { ProfileSessionCard } from "@/components/profile-session-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_ENABLED } from "@/lib/flags";
import { getPublicProfileByUsername, getRelationship } from "@/lib/db/profiles";
import { listActiveGoalsForUser } from "@/lib/db/goals";
import {
  listActiveHabitsForUser,
  listCompletionsForUserInRange,
} from "@/lib/db/habits";
import { listRecentSessionsForUser } from "@/lib/db/sessions";
import { listProfileSessions } from "@/lib/db/profile-sessions";
import { aggregateWeekByGoal } from "@/lib/aggregate";
import { todayInTimeZone, weekRangeInTimeZone } from "@/lib/dates";

import { ProfileActions } from "./profile-actions";

// A user's public profile (social v2). Flag-gated. Identity is visible to any
// logged-in user; goals/habits/sessions are gated by RLS via the relationship
// (self → all incl. private; friend → non-private; otherwise nothing). A
// blocked pair 404s so a block stays invisible.
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!SOCIAL_ENABLED) notFound();
  const me = await requireUser();
  const { username } = await params;

  const target = await getPublicProfileByUsername(username);
  if (!target) notFound();

  const supabase = await createClient();
  const { data: blocked } = await supabase.rpc("are_blocked", {
    a: me.id,
    b: target.userId,
  });
  if (blocked) notFound();

  const relationship = await getRelationship(target.userId);
  const canSeeContent =
    relationship.kind === "self" || relationship.kind === "friends";

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24">
      <main className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <AvatarInitials
            name={target.displayName}
            username={target.username}
            avatarUrl={target.avatarUrl}
            className="size-20 text-2xl"
          />
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {target.displayName || `@${target.username}`}
            </h1>
            <p className="text-muted-foreground text-sm">@{target.username}</p>
          </div>
          {target.bio && <p className="text-sm text-pretty">{target.bio}</p>}
          <ProfileActions target={target} relationship={relationship} />
        </header>

        {canSeeContent ? (
          <ProfileContent
            userId={target.userId}
            isOwn={relationship.kind === "self"}
          />
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center text-sm">
                Add @{target.username} as a friend to see their goals, habits,
                and sessions.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// Goals / habits / sessions for a viewable profile. RLS already filters to what
// the viewer may see, so a friend's private items simply never arrive here.
async function ProfileContent({
  userId,
  isOwn,
}: {
  userId: string;
  isOwn: boolean;
}) {
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const { startDate, endDate } = weekRangeInTimeZone(tz);
  const today = todayInTimeZone(tz);
  const now = Date.now();

  const [goals, sessions, habits, completions, pastSessions] =
    await Promise.all([
      listActiveGoalsForUser(userId),
      listRecentSessionsForUser(userId),
      listActiveHabitsForUser(userId),
      listCompletionsForUserInRange(userId, startDate, endDate),
      listProfileSessions(userId),
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

  return (
    <>
      {goalBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Goals this week</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {goalBreakdown.map((row) => (
              <div key={row.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{row.title}</span>
                  {row.isPrivate && (
                    <LockIcon
                      aria-label="Private"
                      className="text-muted-foreground size-3 shrink-0"
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
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Habits this week</h2>
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
      </div>

      {/* Sessions: their finished, non-private sessions, photo or not. RLS does
          the filtering — private ones never reach us. */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Sessions</h2>
        {pastSessions.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center text-sm">
                No shared sessions yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          pastSessions.map((s) => (
            <ProfileSessionCard
              key={s.sessionId}
              session={s}
              now={now}
              canReport={!isOwn}
            />
          ))
        )}
      </div>
    </>
  );
}
