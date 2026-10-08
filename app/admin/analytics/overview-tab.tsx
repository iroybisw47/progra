import type { Overview } from "@/lib/admin-dashboard";
import { num, pct } from "@/lib/admin-dashboard";

import { HBars, StateBar } from "./charts";
import { NotInstalled, Section, Tile, fmtHours } from "./ui";

export function OverviewTab({ overview }: { overview: Overview | null }) {
  if (!overview) return <NotInstalled what="Overview" />;
  const { now, prior, funnel, retention } = overview;
  const rate = pct(now.activated, now.activation_eligible);
  const priorRate = pct(prior.activated, prior.activation_eligible);
  const hours = num(now.hours_7d) ?? 0;
  const priorHours = num(now.hours_prior_7d) ?? num(prior.hours_7d) ?? 0;

  return (
    <div className="flex flex-col gap-7">
      <Section title="Pulse" hint="Each tile against the same number one week earlier, over the users who existed then.">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Active (logged in 7d)" value={String(now.active)} delta={now.active - prior.active} />
          <Tile label="Ghosts (open, no log)" value={String(now.ghosts)} delta={now.ghosts - prior.ghosts} />
          <Tile
            label="Activated by day 7"
            value={rate === null ? "—" : `${rate}%`}
            delta={rate !== null && priorRate !== null ? rate - priorRate : null}
            sub={`${now.activated} of ${now.activation_eligible} eligible`}
          />
          <Tile label="Hours this week" value={fmtHours(hours)} delta={Math.round((hours - priorHours) * 10) / 10} />
          <Tile
            label="Median friends"
            value={`${num(now.median_friends_doers) ?? "—"} · ${num(now.median_friends_ghosts) ?? "—"}`}
            sub="doers · ghosts"
          />
          <Tile label="Counted users" value={String(now.users)} delta={now.users - prior.users} />
        </div>
      </Section>

      <Section title="Where everyone is" hint="Four exclusive states. Ghosts are an overlay: onboarded, opened this week, logged nothing this week.">
        <StateBar active={now.active} lapsed={now.lapsed} neverLogged={now.never_logged} notOnboarded={now.not_onboarded} />
        <p className="text-caption text-[11px]">
          <span className="text-ink font-semibold">{now.ghosts}</span> of the {now.lapsed + now.never_logged} not-active
          onboarded users opened the app this week — the ghosts.
        </p>
      </Section>

      <Section title="Activation funnel" hint="Friends are as held now; first log ever; activated = 3+ friends and 3+ logged days inside the first 7 days.">
        <HBars
          color="#395AA0"
          rows={[
            { label: "Signed up", value: funnel.signed_up },
            { label: "Onboarded", value: funnel.onboarded },
            { label: "1+ friend", value: funnel.one_friend },
            { label: "First log", value: funnel.first_log },
            { label: "3+ friends", value: funnel.three_friends },
            { label: "Activated", value: funnel.activated },
            { label: "Active in week 4", value: funnel.active_week4, note: `of ${funnel.week4_eligible} with a 4th week` },
          ]}
        />
      </Section>

      <Section title="Retention by signup week" hint="Week k = days 7(k−1)…7k−1 after signup. Split by friends held at day 7. Blank = that week has not finished for anyone — never 0%.">
        {retention.length === 0 ? (
          <p className="text-caption text-sm">No onboarded users in this slice.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-max border-collapse text-xs tabular-nums">
              <thead>
                <tr className="text-caption">
                  <th className="py-1.5 pr-3 text-left font-semibold">Week of</th>
                  <th className="py-1.5 pr-3 text-left font-semibold">Friends@7</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">n</th>
                  {[1, 2, 3, 4].map((k) => (
                    <th key={k} className="w-12 py-1.5 text-center font-semibold">W{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.map((r) => (
                  <tr key={`${r.week_of}-${r.split}`} className="border-hairline border-t">
                    <td className="py-1.5 pr-3 font-medium">{r.week_of.slice(5)}</td>
                    <td className="py-1.5 pr-3">{r.split}</td>
                    <td className="text-caption py-1.5 pr-3 text-right">{r.n}</td>
                    {r.weeks.map((cell, k) => {
                      if (!cell) return <td key={k} className="py-1.5" />;
                      const p = pct(cell.n, cell.m) ?? 0;
                      return (
                        <td key={k} className="py-1.5 text-center">
                          <span
                            className="inline-flex flex-col items-center rounded px-1 py-0.5"
                            style={{ backgroundColor: `color-mix(in oklab, #395AA0 ${Math.round(p * 0.35)}%, transparent)` }}
                          >
                            <span className="font-semibold">{p}%</span>
                            <span className="text-caption text-[9px]">{cell.n}/{cell.m}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
