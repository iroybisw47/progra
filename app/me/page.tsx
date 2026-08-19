import { notFound } from "next/navigation";
import Link from "next/link";
import { HeartIcon, SettingsIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { Dashboard } from "@/components/dashboard";
import { GoalQuotaRows } from "@/components/v2/goal-quota-rows";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { createClient } from "@/lib/supabase/server";
import { REDESIGN, SOCIAL_ENABLED } from "@/lib/flags";
import { listActiveGoalsForUser } from "@/lib/db/goals";
import {
  listActiveHabitsForUser,
  listCompletionsForUserInRange,
} from "@/lib/db/habits";
import { listRecentSessionsForUser } from "@/lib/db/sessions";
import { listProfileSessions } from "@/lib/db/profile-sessions";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { entityColor } from "@/lib/colors";
import { formatDuration } from "@/lib/duration";
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

  // Reactions are session-keyed, so they chain off the sessions read alone
  // rather than the whole wave — same pattern as FeedV2, so they resolve
  // alongside goals/habits instead of waiting for them. (Comments aren't read
  // here any more: the session list is a compact row per session, and the
  // thread lives on /session/[id].)
  const pastSessionsPromise = listProfileSessions(user.id);
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
  ] = await Promise.all([
    listActiveGoalsForUser(user.id),
    listRecentSessionsForUser(user.id),
    listActiveHabitsForUser(user.id),
    listCompletionsForUserInRange(user.id, startDate, endDate),
    pastSessionsPromise,
    reactionsPromise,
  ]);

  const goalWeekly = aggregateWeekByGoal(sessions, now);
  const goalBreakdown = goals
    .map((g) => ({
      id: g.id,
      title: g.title,
      color: g.color,
      quotaHours: g.weeklyQuotaHours,
      actualMs: goalWeekly.perGoal.get(g.id) ?? 0,
      isPrivate: g.isPrivate,
    }))
    .sort((a, b) => b.actualMs - a.actualMs);
  const weekTotalMs = goalBreakdown.reduce((s, r) => s + r.actualMs, 0);

  // Date-grouped session list ("Today" / "Yesterday" / "Mon 6 Jul").
  const groups: { label: string; items: typeof pastSessions }[] = [];
  for (const s of pastSessions) {
    const label = dayGroupLabel(s.endedAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center justify-between px-5">
          <span className="section-label">You</span>
          <Link
            href="/settings"
            aria-label="Settings"
            className="border-hairline text-caption hover:border-brand flex size-8 items-center justify-center rounded-[11px] border-[1.5px]"
          >
            <SettingsIcon className="size-[15px]" />
          </Link>
        </header>

        {/* Identity */}
        <div className="flex items-center gap-3.5 px-5 pt-4">
          <AvatarInitials
            name={profile?.display_name ?? null}
            username={profile?.username ?? "?"}
            avatarUrl={avatarPublicUrl(profile?.avatar_path ?? null)}
            className="size-[58px] text-xl"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-ink truncate font-serif text-[22px] font-medium tracking-[-0.015em]">
              {profile?.display_name ||
                (profile?.username ? `@${profile.username}` : "You")}
            </span>
            {profile?.username && (
              <span className="text-faint truncate text-[13px]">
                @{profile.username}
              </span>
            )}
            {profile?.bio && (
              <span className="text-body mt-1 text-[13px] text-pretty">
                {profile.bio}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex px-5 pt-[18px]">
          <Stat value={formatHours(weekTotalMs)} label="This week" />
          <Stat value={String(pastSessions.length)} label="Sessions" />
          <Stat value={String(completions.length)} label="Habits done" />
        </div>

        <div className="bg-track border-hairline mt-5 h-1.5 border-t" />

        {/* Goal quotas — the same rows as Progress. */}
        {goalBreakdown.length > 0 && (
          <section className="flex flex-col">
            <div className="flex items-center gap-[7px] px-5 pt-4 pb-2">
              <span className="section-label">Goal quotas</span>
              <span className="flex-1" />
              <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
                {goalBreakdown.length} active
              </span>
            </div>
            <div className="px-5">
              <GoalQuotaRows goals={goalBreakdown} />
            </div>
            <div className="bg-hairline mx-5 mt-4 h-px" />
          </section>
        )}

        {/* Habits this week — the same grid as Progress. */}
        <section className="flex flex-col">
          <div className="flex items-center gap-[7px] px-5 pt-3.5 pb-2">
            <span className="section-label">Habits</span>
            <span className="flex-1" />
            <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
              {completions.length} of {habits.length * 7}
            </span>
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

        {/* Sessions — your history. Private ones are included here (this is
            your own profile); friends only ever see the non-private ones. */}
        <section className="flex flex-col">
          <div className="flex items-center gap-[7px] px-5 pt-4 pb-1.5">
            <span className="section-label">Your sessions</span>
            <span className="flex-1" />
            <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
              {pastSessions.length}
            </span>
          </div>
          {pastSessions.length === 0 ? (
            <p className="text-caption border-divider border-t px-5 py-4 text-[13px]">
              Your finished sessions show up here.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="flex flex-col">
                <span className="text-disabled px-5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                  {group.label}
                </span>
                {group.items.map((s) => {
                  const like = (reactionsBySession.get(s.sessionId) ?? []).find(
                    (r) => r.emoji === LIKE_EMOJI
                  );
                  return (
                    <Link
                      key={s.sessionId}
                      href={`/session/${s.sessionId}`}
                      className="border-divider flex items-center gap-[11px] border-t px-5 py-[9px]"
                    >
                      <span
                        aria-hidden
                        className="h-[26px] w-[3px] shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: entityColor(
                            s.attribution?.color ?? null
                          ),
                        }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">
                          {s.title}
                        </span>
                        <span className="text-faint truncate text-[11px] leading-[1.3]">
                          {s.attribution?.text ?? "Uncategorized"}
                          {s.isPrivate && " · private"}
                        </span>
                      </div>
                      {like && like.count > 0 && (
                        <span className="text-disabled flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums">
                          <HeartIcon className="size-3" />
                          {like.count}
                        </span>
                      )}
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-secondary-ink">
                        {formatDuration(s.workedMs)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </section>

        <div className="px-5 pt-5">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="border-hairline text-caption hover:border-warm-border h-11 w-full rounded-[14px] border-[1.5px] text-[13px] font-semibold"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </div>
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

// "Today" / "Yesterday" / "Mon 6 Jul" for a session's end time.
function dayGroupLabel(endedAt: number, now: number): string {
  const day = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diffDays = Math.round((day(now) - day(endedAt)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Date(endedAt).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
