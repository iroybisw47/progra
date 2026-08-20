import { notFound } from "next/navigation";
import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { BackButton } from "@/components/v2/back-button";
import { GoalQuotaRows } from "@/components/v2/goal-quota-rows";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { KudosButton } from "@/components/kudos-button";
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
import {
  countProfileSessions,
  listProfileSessions,
} from "@/lib/db/profile-sessions";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { aggregateWeekByGoal } from "@/lib/aggregate";
import { entityColor, goalColorOf } from "@/lib/colors";
import { formatDuration } from "@/lib/duration";
import { todayInTimeZone, weekRangeInTimeZone } from "@/lib/dates";

import { ProfileActions } from "./profile-actions";

const HOUR_MS = 60 * 60 * 1000;
const formatHours = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

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
    <div className="flex flex-1 flex-col items-center pt-7 pb-24">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center gap-2.5 px-5">
          <BackButton />
          <span className="section-label">Profile</span>
        </header>

        {/* Identity */}
        {/* items-start, not items-center: a long name now WRAPS instead of
            truncating, and the gear should stay level with the first line
            rather than drifting to the vertical middle of a two-line name. */}
        <div className="flex items-start gap-3.5 px-5 pt-4">
          <AvatarInitials
            name={target.displayName}
            username={target.username}
            avatarUrl={target.avatarUrl}
            className="size-[58px] shrink-0 text-xl"
          />
          <div className="flex min-w-0 flex-1 flex-col pt-1">
            {/* No truncate. The old row could carry three action chips, which is
                what squeezed the name; a single 32px gear leaves it the line. */}
            <h1 className="text-ink font-serif text-[22px] leading-[1.2] font-medium tracking-[-0.015em] text-balance">
              {target.displayName || `@${target.username}`}
            </h1>
            <span className="text-faint truncate text-[13px]">
              @{target.username}
            </span>
          </div>
          <div className="pt-1.5">
            <ProfileActions target={target} relationship={relationship} />
          </div>
        </div>
        {target.bio && (
          <p className="text-body px-5 pt-2.5 text-[13px] text-pretty">
            {target.bio}
          </p>
        )}

        {canSeeContent ? (
          <ProfileContent
            userId={target.userId}
            isOwn={relationship.kind === "self"}
          />
        ) : (
          <>
            <div className="bg-track border-hairline mt-5 h-1.5 border-t" />
            <p className="text-caption px-5 py-8 text-center text-[13px] text-pretty">
              Add @{target.username} as a friend to see their goals, habits, and
              sessions.
            </p>
          </>
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
  void isOwn;
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const { startDate, endDate } = weekRangeInTimeZone(tz);
  const today = todayInTimeZone(tz);
  const now = Date.now();

  // Reactions chain off the sessions read alone (FeedV2's pattern), so they
  // resolve alongside goals/habits rather than after them. Comments aren't read
  // here: a session row links to /session/[id], where the thread lives.
  const pastSessionsPromise = listProfileSessions(userId);
  // Counted in the database, not from the array above — the array is capped, so
  // deriving the stat from it pins a heavy user's profile at the cap forever.
  const sessionCountPromise = countProfileSessions(userId);
  const reactionsPromise = pastSessionsPromise.then((items) =>
    listReactionsForSessions(items.map((i) => i.sessionId))
  );
  const [
    goals,
    sessions,
    habits,
    completions,
    pastSessions,
    reactionsBySession,
    sessionCount,
  ] =
    await Promise.all([
      listActiveGoalsForUser(userId),
      listRecentSessionsForUser(userId),
      listActiveHabitsForUser(userId),
      listCompletionsForUserInRange(userId, startDate, endDate),
      pastSessionsPromise,
      reactionsPromise,
      sessionCountPromise,
    ]);

  const goalWeekly = aggregateWeekByGoal(sessions, now);
  const goalBreakdown = goals
    .map((g) => ({
      id: g.id,
      title: g.title,
      color: g.color,
      quotaHours: g.weeklyQuotaHours,
      actualMs: goalWeekly.perGoal.get(g.id) ?? 0,
    }))
    .sort((a, b) => b.actualMs - a.actualMs);
  const weekTotalMs = goalWeekly.total;

  return (
    <>
      {/* Stats */}
      <div className="flex px-5 pt-[18px]">
        <Stat value={formatHours(weekTotalMs)} label="This week" />
        <Stat value={String(sessionCount)} label="Sessions" />
        <Stat value={String(goalBreakdown.length)} label="Goals" />
      </div>

      <div className="bg-track border-hairline mt-5 h-1.5 border-t" />

      {/* Their week — one segmented bar, then the same quota rows the
          leaderboard expansion uses. */}
      <section className="flex flex-col">
        <div className="flex items-center gap-[7px] px-5 pt-4 pb-2">
          <span className="section-label">Their week</span>
          <span className="flex-1" />
          <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
            {formatHours(weekTotalMs)}
          </span>
        </div>
        {goalBreakdown.length === 0 ? (
          <p className="text-caption border-divider border-t px-5 py-3 text-[13px]">
            Nothing tracked against a goal this week.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 px-5">
            <div className="bg-track flex h-[9px] w-full gap-[3px] overflow-hidden rounded-full">
              {goalBreakdown.map((g) => (
                <span
                  key={g.id}
                  className="h-full"
                  style={{
                    width:
                      weekTotalMs > 0
                        ? `${(g.actualMs / weekTotalMs) * 100}%`
                        : "0%",
                    backgroundColor: goalColorOf(g),
                  }}
                />
              ))}
            </div>
            <GoalQuotaRows goals={goalBreakdown} />
          </div>
        )}
        <div className="bg-hairline mx-5 mt-4 h-px" />
      </section>

      {/* Habits this week */}
      <section className="flex flex-col">
        <div className="flex items-center gap-[7px] px-5 pt-3.5 pb-2">
          <span className="section-label">Habits</span>
        </div>
        <div className="px-5">
          <HabitWeekGrid
            habits={habits}
            completions={completions}
            weekStart={startDate}
            today={today}
          />
        </div>
      </section>

      <div className="bg-track border-hairline mt-[18px] h-1.5 border-t" />

      {/* Sessions: their finished, non-private sessions. RLS does the
          filtering — private ones never reach us. */}
      <section className="flex flex-col">
        <div className="flex items-center gap-[7px] px-5 pt-4 pb-1.5">
          <span className="section-label">Recent sessions</span>
          <span className="flex-1" />
          <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
            {sessionCount}
          </span>
        </div>
        {pastSessions.length === 0 ? (
          <p className="text-caption border-divider border-t px-5 py-4 text-[13px]">
            No shared sessions yet.
          </p>
        ) : (
          pastSessions.map((s) => {
            const like = (reactionsBySession.get(s.sessionId) ?? []).find(
              (r) => r.emoji === LIKE_EMOJI
            );
            return (
              <div
                key={s.sessionId}
                className="border-divider flex items-center gap-2.5 border-t px-5 py-[11px]"
              >
                <span
                  aria-hidden
                  className="h-6 w-[3px] shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: entityColor(s.attribution?.color ?? null),
                  }}
                />
                <Link
                  href={`/session/${s.sessionId}`}
                  className="flex min-w-0 flex-1 flex-col"
                >
                  <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">
                    {s.title}
                  </span>
                  <span className="text-faint truncate text-[11px] leading-[1.3]">
                    {s.attribution?.text ?? "Uncategorized"}
                  </span>
                </Link>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-secondary-ink">
                  {formatDuration(s.workedMs)}
                </span>
                <KudosButton
                  sessionId={s.sessionId}
                  count={like?.count ?? 0}
                  likedByMe={like?.mine ?? false}
                />
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

// One of the three serif numbers under the identity block.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="stat-num text-[21px]">{value}</span>
      <span className="text-disabled text-[9px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </span>
    </div>
  );
}
