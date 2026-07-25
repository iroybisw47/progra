import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Donut } from "@/components/v2/donut";
import { formatDuration } from "@/lib/duration";

const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

export type WeekSummarySeg = { name: string; color: string; ms: number };
export type WeekSummaryGoal = {
  id: string;
  title: string;
  quotaHours: number;
  actualMs: number;
  status: "hit" | "close" | "under";
};

// Category legend rows shared by the week donut and the Progress History card.
export function Legend({
  segs,
  total,
}: {
  segs: WeekSummarySeg[];
  total: number;
}) {
  return (
    <ul className="flex flex-1 flex-col gap-2">
      {segs.slice(0, 6).map((s, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          <span className="min-w-0 flex-1 truncate">{s.name}</span>
          <span className="text-caption font-mono text-xs tabular-nums">
            {fmtH(s.ms)}
          </span>
          <span className="text-faint w-9 text-right font-mono text-xs tabular-nums">
            {total > 0 ? Math.round((s.ms / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

// THE weekly presentation: donut + category legend + goal quota bars. Lifted
// from the Progress tab's This-week section and rendered by BOTH Progress and
// History's week view, so the two surfaces can never drift apart in format.
export function WeekSummary({
  totalMs,
  segs,
  goals,
  goalsHeaderExtra,
  heroDonut = false,
  rangeLabel,
  tracked,
  imported,
}: {
  totalMs: number;
  segs: WeekSummarySeg[];
  goals: WeekSummaryGoal[];
  // Progress passes its "Manage" link here; History passes nothing.
  goalsHeaderExtra?: ReactNode;
  // Progress's This-week tab opts into the big centered donut (matching its
  // Today tab); History's week view keeps the compact side-by-side layout.
  heroDonut?: boolean;
  // Hero-only caption (mirrors the Today tab): week date range + row counts.
  rangeLabel?: string;
  tracked?: number;
  imported?: number;
}) {
  const donutSegments = segs.map((s) => ({ color: s.color, value: s.ms }));
  const hasLegend = segs.length > 0;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        {heroDonut ? (
          // Tight spacing so the donut hero doesn't leave dead space — extra
          // trim on the bottom when there's no legend (empty week).
          <CardContent
            className={`flex flex-col gap-2 px-4 pt-4 ${hasLegend ? "pb-4" : "pb-2"}`}
          >
            {rangeLabel && (
              <div className="flex items-baseline justify-between">
                <span className="text-caption text-[11px] font-bold uppercase tracking-wide">
                  This week · {rangeLabel}
                </span>
                <span className="text-caption text-xs">
                  {tracked ?? 0} tracked · {imported ?? 0} imported
                </span>
              </div>
            )}
            <div className="flex justify-center">
              <Donut
                segments={donutSegments}
                size={240}
                stroke={22}
                label={formatDuration(totalMs)}
                labelClassName="text-4xl"
                sub="Tracked"
              />
            </div>
            {hasLegend && <Legend segs={segs} total={totalMs} />}
          </CardContent>
        ) : (
          <CardContent className="flex items-center gap-5 py-5">
            <Donut
              segments={donutSegments}
              size={128}
              stroke={13}
              label={formatDuration(totalMs)}
              sub="Tracked"
            />
            <Legend segs={segs} total={totalMs} />
          </CardContent>
        )}
      </Card>

      {goals.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Goal quotas</h2>
            {goalsHeaderExtra}
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4 py-4">
              {goals.map((g) => {
                const quotaMs = g.quotaHours * HOUR_MS;
                const pct =
                  quotaMs > 0 ? Math.min(100, (g.actualMs / quotaMs) * 100) : 0;
                return (
                  <div key={g.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{g.title}</span>
                      <span className="text-caption shrink-0 font-mono text-xs tabular-nums">
                        {fmtH(g.actualMs)} / {g.quotaHours.toFixed(0)}h
                      </span>
                    </div>
                    <div className="bg-track h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-brand h-full"
                        style={{
                          width: g.actualMs > 0 ? `${Math.max(2, pct)}%` : "0%",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
