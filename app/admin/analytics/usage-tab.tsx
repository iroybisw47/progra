import { GOAL_CATEGORY_LABELS, isGoalCategory } from "@/lib/goal-categories";
import type { NotificationStats, UsageSocial } from "@/lib/admin-dashboard";
import { num, pct } from "@/lib/admin-dashboard";

import { CategorizeButton } from "./categorize-button";
import { HBars, PerUserSeries, RateBars, SLOT } from "./charts";
import { Collecting, KV, NotInstalled, STATE_LABEL, Section, Tile, fmtPct } from "./ui";

const TYPE_LABEL: Record<string, string> = {
  clock_in_reminder: "Clock reminder",
  habit_reminder: "Habit reminder",
  like: "Like",
  comment: "Comment",
  reply: "Reply",
  nudge: "Nudge",
  recap: "Weekly recap",
};

function categoryLabel(c: string): string {
  if (isGoalCategory(c)) return GOAL_CATEGORY_LABELS[c];
  return c === "private" ? "Private (never sent)" : "Not labelled yet";
}

export function UsageTab({ usage, notifications }: { usage: UsageSocial | null; notifications: NotificationStats | null }) {
  if (!usage) return <NotInstalled what="Usage & social" />;
  const { usage_mix: mix, session_quality: q, interactions: ix, nudges, social_pull: pull } = usage;
  const unlabeled = usage.goals_by_category.find((g) => g.category === "unlabeled")?.goals ?? 0;
  const series = usage.series.map((d) => ({
    day: d.day,
    clock: d.active_users ? Math.round((d.clock_ins / d.active_users) * 100) / 100 : 0,
    habit: d.active_users ? Math.round((d.habit_checks / d.active_users) * 100) / 100 : 0,
  }));

  return (
    <div className="flex flex-col gap-7">
      <Section title={`Clock-ins vs habit checks, per active user · ${usage.from.slice(5)} → ${usage.to.slice(5)}`}>
        <PerUserSeries rows={series} />
      </Section>

      <Section title="Usage mix" hint="Among users with a log in the last 7 days.">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Both" value={String(mix.both)} sub={fmtPct(pct(mix.both, mix.active))} />
          <Tile label="Clock-in only" value={String(mix.clock_only)} sub={fmtPct(pct(mix.clock_only, mix.active))} />
          <Tile label="Habits only" value={String(mix.habits_only)} sub={fmtPct(pct(mix.habits_only, mix.active))} />
        </div>
        <p className="text-caption text-[11px]">
          Ever: {mix.ever_both} both · {mix.ever_clock_only} clock only · {mix.ever_habits_only} habits only · {mix.ever_neither} neither.
        </p>
      </Section>

      <Section title="Session quality" hint="Sessions started in the range. An auto-ended session is a forgotten clock-out and counts as zero hours everywhere.">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Sessions per doer" value={String(num(q.sessions_per_doer) ?? "—")} sub={`${q.sessions} sessions · ${q.doers} doers`} />
          <Tile label="Median session" value={num(q.median_session_min) === null ? "—" : `${num(q.median_session_min)} min`} />
          <Tile label="Auto-ended" value={fmtPct(num(q.pct_auto_ended))} />
          <Tile label="Logged vs target (7d)" value={`${num(q.logged_hours_7d) ?? 0}h / ${num(q.target_hours) ?? 0}h`} sub="active users · their weekly quotas" />
        </div>
      </Section>

      <Section title="Goals by category" hint="Labelled by Haiku 4.5 from the title. Private goals are never sent and sit in their own bucket.">
        <div className="flex justify-end">
          <CategorizeButton unlabeled={unlabeled} />
        </div>
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr className="text-caption">
              <th className="py-1 text-left font-semibold">Category</th>
              <th className="py-1 text-right font-semibold">Users</th>
              <th className="py-1 text-right font-semibold">Ever logged</th>
              <th className="py-1 text-right font-semibold">Hours 7d</th>
              <th className="py-1 text-right font-semibold">Wk-4 ret.</th>
            </tr>
          </thead>
          <tbody>
            {usage.goals_by_category.map((g) => (
              <tr key={g.category} className="border-hairline border-t">
                <td className="py-1.5">{categoryLabel(g.category)}</td>
                <td className="py-1.5 text-right">{g.users}</td>
                <td className="py-1.5 text-right">{fmtPct(num(g.pct_ever_logged))}</td>
                <td className="py-1.5 text-right">{num(g.hours_7d)}h</td>
                <td className="py-1.5 text-right">{g.week4_retention ? `${fmtPct(pct(g.week4_retention.n, g.week4_retention.m))} (${g.week4_retention.n}/${g.week4_retention.m})` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Friends and activity" hint="Onboarded users by accepted, non-internal friends; the bar is users, the note is how many are active.">
        <HBars
          rows={usage.friend_buckets.map((b) => ({ label: `${b.bucket} friends`, value: b.users, note: `${b.active} active (${fmtPct(pct(b.active, b.users))})` }))}
          height={usage.friend_buckets.length * 30 + 8}
        />
      </Section>

      <Section title="Interactions, last 7 days">
        <KV
          rows={[
            ["Likes given", ix.likes],
            ["Comments given", ix.comments],
            ["Profile views", ix.profile_views],
            ["Nudges sent", ix.nudges],
            ["Per active user", num(ix.per_active_user) ?? "—"],
          ]}
        />
      </Section>

      <Section title="Nudges" hint="Sent → push tapped → the nudged habit checked (or a session on the nudged goal) within 24h, against the recipient's own daily log rate over 28 days.">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Sent" value={String(nudges.sent)} />
          <Tile label="Opened" value={String(nudges.opened)} sub={fmtPct(pct(nudges.opened, nudges.sent))} />
          <Tile label="Converted" value={String(nudges.converted)} sub={`${fmtPct(pct(nudges.converted, nudges.sent))} vs ${fmtPct(num(nudges.baseline_pct))} baseline`} />
        </div>
      </Section>

      <Section title="Social pull">
        {usage.collecting_data ? (
          <Collecting>Needs two weeks of events before these are worth reading.</Collecting>
        ) : (
          <KV
            rows={[
              ["Sessions within 3h of a friend's", `${fmtPct(pct(pull.after_friend, pull.sessions_with_friends))} of ${pull.sessions_with_friends}`],
              ["…expected by chance", fmtPct(num(pull.after_friend_baseline_pct))],
              ["Opened within 24h of a like/comment/nudge", `${fmtPct(pct(pull.returned_after_social, pull.social_events))} of ${pull.social_events}`],
              ["Daily open rate, users who got nothing", `${fmtPct(num(pull.quiet_daily_open_pct))} (n=${pull.quiet_users})`],
            ]}
          />
        )}
      </Section>

      <NotificationsSection stats={notifications} />
    </div>
  );
}

function NotificationsSection({ stats }: { stats: NotificationStats | null }) {
  if (!stats) return <NotInstalled what="Notifications" />;
  const byHour = stats.by_hour.map((h) => ({
    label: `${h.hour}h`,
    converted: pct(h.converted, h.sent) ?? 0,
    baseline: num(h.baseline_pct) ?? 0,
  }));
  const fatigue = stats.fatigue.map((f) => ({ label: `${f.per_day}/day`, tapped: pct(f.tapped, f.sent) ?? 0, converted: pct(f.converted, f.sent) ?? 0 }));
  const byState = stats.by_state.map((s) => ({
    label: s.ghost ? "Ghost" : STATE_LABEL[s.state] ?? s.state,
    tapped: pct(s.tapped, s.sent) ?? 0,
    converted: pct(s.converted, s.sent) ?? 0,
  }));

  return (
    <>
      <Section
        title="Notifications, by type"
        hint="Remote = APNs accepted it. Local = presumed fired (scheduled, never cancelled). Converted: clock reminder → clocked out within 30 min; habit reminder → checked within 6h; nudge → within 24h; like/comment/reply/recap → app opened within 24h. Baseline = the same user in the same window on the 7 days before. Lift = converted − baseline."
      >
        {stats.collecting_data && <Collecting>Lift needs two weeks of log; counts below are real already.</Collecting>}
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-max min-w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="text-caption">
                <th className="py-1 pr-3 text-left font-semibold">Type</th>
                <th className="py-1 pr-3 text-right font-semibold">Sent</th>
                <th className="py-1 pr-3 text-right font-semibold">Tap</th>
                <th className="py-1 pr-3 text-right font-semibold">Influenced</th>
                <th className="py-1 pr-3 text-right font-semibold">Converted</th>
                <th className="py-1 pr-3 text-right font-semibold">Baseline</th>
                <th className="py-1 text-right font-semibold">Lift</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_type.map((t) => (
                <tr key={`${t.type}-${t.channel}`} className="border-hairline border-t">
                  <td className="py-1.5 pr-3">
                    {TYPE_LABEL[t.type] ?? t.type} <span className="text-caption">· {t.channel}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">{t.sent}</td>
                  <td className="py-1.5 pr-3 text-right">{fmtPct(pct(t.tapped, t.sent))}</td>
                  <td className="py-1.5 pr-3 text-right">{fmtPct(pct(t.influenced, t.sent))}</td>
                  <td className="py-1.5 pr-3 text-right">{fmtPct(pct(t.converted, t.sent))}</td>
                  <td className="py-1.5 pr-3 text-right">{stats.collecting_data ? "…" : fmtPct(num(t.baseline_pct))}</td>
                  <td className="py-1.5 text-right font-semibold">{stats.collecting_data ? "…" : num(t.lift_pct) === null ? "—" : `${(num(t.lift_pct) ?? 0) > 0 ? "+" : ""}${num(t.lift_pct)}`}</td>
                </tr>
              ))}
              {stats.by_type.length === 0 && (
                <tr><td colSpan={7} className="text-caption py-2">No notifications in the range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Lift by hour of day" hint="Converted % against baseline %, by the user's local hour the notification landed.">
        {byHour.length === 0 ? <p className="text-caption text-sm">Nothing yet.</p> : (
          <RateBars rows={byHour} a={{ key: "converted", label: "Converted %" }} b={{ key: "baseline", label: "Baseline %", color: SLOT.neutral }} />
        )}
      </Section>

      <Section title="Fatigue" hint="Response by how many notifications that user got that day.">
        {fatigue.length === 0 ? <p className="text-caption text-sm">Nothing yet.</p> : (
          <RateBars rows={fatigue} a={{ key: "tapped", label: "Tapped %" }} b={{ key: "converted", label: "Converted %", color: SLOT.green }} />
        )}
      </Section>

      <Section title="Response by user state">
        {byState.length === 0 ? <p className="text-caption text-sm">Nothing yet.</p> : (
          <RateBars rows={byState} a={{ key: "tapped", label: "Tapped %" }} b={{ key: "converted", label: "Converted %", color: SLOT.green }} />
        )}
      </Section>

      <Section title="Permission and toggles" hint="iOS permission as the device last reported it, over onboarded users.">
        <HBars rows={stats.permission.map((p) => ({ label: p.permission, value: p.users }))} height={stats.permission.length * 30 + 8} />
        <KV
          rows={[
            ["Social pushes off", `${stats.toggles.social_pushes_off} of ${stats.toggles.users}`],
            ["Nudges off", `${stats.toggles.nudges_off} of ${stats.toggles.users}`],
            ["Clock reminders off (this session)", `${stats.toggles.clock_reminders_off} of ${stats.toggles.prefs_reported} reporting`],
            ["Habit reminder off", `${stats.toggles.habit_reminder_off} of ${stats.toggles.prefs_reported} reporting`],
          ]}
        />
      </Section>
    </>
  );
}
