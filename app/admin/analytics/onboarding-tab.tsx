import Link from "next/link";

import type { GhostBehavior, OnboardingStats, Roster as RosterData } from "@/lib/admin-dashboard";
import { num, pct } from "@/lib/admin-dashboard";
import { STEPS } from "@/lib/onboarding";

import { HBars, SLOT } from "./charts";
import { Roster } from "./roster";
import { KV, NotInstalled, Section, Tag, fmtAgo, fmtPct } from "./ui";

export function OnboardingTab({
  onboarding,
  ghosts,
  roster,
}: {
  onboarding: OnboardingStats | null;
  ghosts: GhostBehavior | null;
  roster: RosterData | null;
}) {
  const nowMs = roster ? Date.parse(roster.generatedAt) : Date.parse(onboarding?.generated_at ?? new Date().toISOString());
  return (
    <div className="flex flex-col gap-7">
      {onboarding ? <OnboardingSections stats={onboarding} nowMs={nowMs} /> : <NotInstalled what="Onboarding" />}
      {ghosts ? <GhostSections stats={ghosts} /> : <NotInstalled what="Ghost behaviour" />}
      <Section title={`Roster${roster ? ` (${roster.users.length})` : ""}`} hint="Every row opens that person's internal event timeline.">
        {roster ? <Roster users={roster.users} nowMs={nowMs} /> : <NotInstalled what="Roster" />}
      </Section>
    </div>
  );
}

function OnboardingSections({ stats, nowMs }: { stats: OnboardingStats; nowMs: number }) {
  const all = STEPS.map((step) => stats.steps.find((s) => s.step === step && s.provider === "all")).filter((s): s is NonNullable<typeof s> => !!s);
  const providers = [...new Set(stats.steps.map((s) => s.provider).filter((p) => p !== "all"))];
  const stuckByStep = all.map((s) => ({ label: s.step, value: s.stuck }));
  return (
    <>
      <Section title="Drop-off by screen" hint="Users who reached each screen (a view event, a step at or past it, or finishing). notify is native-only; uw is UW students only.">
        <HBars rows={all.map((s) => ({ label: s.step, value: s.reached, note: `median ${num(s.median_seconds) ?? "—"}s on screen` }))} height={all.length * 26 + 8} />
      </Section>
      <Section title="Stuck, by last screen" hint="Not onboarded and unseen for 48h+.">
        {stuckByStep.every((s) => s.value === 0) ? (
          <p className="text-caption text-sm">Nobody is stuck.</p>
        ) : (
          <HBars rows={stuckByStep.filter((s) => s.value > 0)} color={SLOT.orange} height={stuckByStep.filter((s) => s.value > 0).length * 26 + 8} />
        )}
      </Section>
      {providers.length > 1 && (
        <Section title="By sign-in method" hint="Reached · stuck · median seconds, per screen.">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-max min-w-full border-collapse text-xs tabular-nums">
              <thead>
                <tr className="text-caption">
                  <th className="py-1 pr-3 text-left font-semibold">Screen</th>
                  {providers.map((p) => (
                    <th key={p} className="py-1 pr-3 text-right font-semibold">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STEPS.map((step) => (
                  <tr key={step} className="border-hairline border-t">
                    <td className="py-1.5 pr-3">{step}</td>
                    {providers.map((p) => {
                      const s = stats.steps.find((x) => x.step === step && x.provider === p);
                      return (
                        <td key={p} className="py-1.5 pr-3 text-right">
                          {s ? `${s.reached} · ${s.stuck} · ${num(s.median_seconds) ?? "—"}s` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <Section title={`Stuck users (${stats.stuck_users.length})`}>
        {stats.stuck_users.length === 0 ? (
          <p className="text-caption text-sm">None.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs">
            {stats.stuck_users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2">
                <Link href={`/admin/analytics/user/${u.id}`} className="min-w-0 truncate font-semibold underline-offset-2 hover:underline">
                  {u.display_name || (u.username ? `@${u.username}` : u.id.slice(0, 8))}
                </Link>
                <span className="text-caption shrink-0 tabular-nums">
                  {u.step ?? "?"}{u.inferred ? " (inferred)" : ""} · {u.provider} · opened {fmtAgo(u.last_opened_at, nowMs)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Possible duplicates" hint="Same display name, different sign-in providers. Flagged only — you decide, with admin_set_internal(…, 'duplicate').">
        {stats.duplicates.length === 0 ? (
          <p className="text-caption text-sm">None.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-xs">
            {stats.duplicates.map((d) => (
              <li key={d.display_name} className="border-hairline rounded-lg border px-3 py-2">
                <p className="font-semibold">{d.display_name}</p>
                {d.users.map((u) => (
                  <p key={u.id} className="text-caption flex justify-between gap-2">
                    <Link href={`/admin/analytics/user/${u.id}`} className="truncate underline-offset-2 hover:underline">
                      {u.username ? `@${u.username}` : u.id.slice(0, 8)} · {u.provider} · {u.email ?? "no email"}
                    </Link>
                    <span className="shrink-0">{u.state}</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function GhostSections({ stats }: { stats: GhostBehavior }) {
  const s = stats.sessions;
  const share = (n: number) => pct(n, s.app_sessions) ?? 0;
  const behaviours = [
    { label: "Viewed the feed", value: share(s.feed_viewed) },
    { label: "Viewed a profile", value: share(s.profile_view) },
    { label: "Liked or commented", value: share(s.like_or_comment) },
    { label: "Clock screen, no start", value: share(s.clock_screen_no_start) },
    { label: "Cancelled a session", value: share(s.session_cancelled) },
    { label: "Edited a goal", value: share(s.goal_edit) },
    { label: "Left within 10s", value: share(s.bounced_10s) },
  ];
  const freq = Object.entries(stats.frequency.buckets).map(([k, v]) => ({ label: `${k} opens / 7d`, value: v }));
  const cmp = (c: GhostBehavior["compare"]["ghosts"]) =>
    `${num(c.median_friends) ?? "—"} · ${num(c.median_opens_7d) ?? "—"} · ${fmtPct(num(c.pct_permission_granted))} · ${fmtPct(num(c.pct_with_goal))} · ${fmtPct(num(c.pct_with_habit))}`;
  return (
    <>
      <Section title={`Ghosts: how often they open (${stats.frequency.ghosts})`} hint={`Average ${num(stats.frequency.avg_opens_7d) ?? "—"} opens on ${num(stats.frequency.avg_days_opened_7d) ?? "—"} days this week.`}>
        <HBars rows={freq} color={SLOT.purple} height={freq.length * 26 + 8} />
      </Section>
      <Section title={`What ghosts do when they open (${s.app_sessions} app sessions, 14d)`} hint="Share of ghost app sessions with each behaviour.">
        {s.app_sessions === 0 ? (
          <p className="text-caption text-sm">No ghost app sessions recorded yet.</p>
        ) : (
          <HBars rows={behaviours} color={SLOT.purple} suffix="%" height={behaviours.length * 26 + 8} />
        )}
      </Section>
      <Section title="Ghosts vs doers" hint="median friends · median opens 7d · permission granted · has a goal · has a habit">
        <KV
          rows={[
            [<span key="g"><Tag tone="ghost">ghosts</Tag> n={stats.compare.ghosts.n}</span>, cmp(stats.compare.ghosts)],
            [<span key="d"><Tag tone="state">doers</Tag> n={stats.compare.doers.n}</span>, cmp(stats.compare.doers)],
          ].map(([k, v]) => [String((k as React.ReactElement).key), v] as [string, React.ReactNode])}
        />
        <p className="text-caption text-[11px]">g = ghosts (n={stats.compare.ghosts.n}) · d = doers, i.e. active (n={stats.compare.doers.n}).</p>
      </Section>
    </>
  );
}
