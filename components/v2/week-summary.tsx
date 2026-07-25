import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { CategoryDonut } from "@/components/v2/category-donut";
import type { CategoryItem } from "@/lib/aggregate";

const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

export type WeekSummarySeg = {
  // Category id ("goal:<id>", or absent = Uncategorized) for the items lookup.
  id?: string | null;
  name: string;
  color: string;
  ms: number;
};
export type WeekSummaryGoal = {
  id: string;
  title: string;
  quotaHours: number;
  actualMs: number;
  status: "hit" | "close" | "under";
};

// THE weekly presentation: the shared category donut (centered donut + per-
// category bars) + goal quota bars. Rendered by BOTH the Progress This-week tab
// and History's week view, so the two surfaces can never drift apart in format.
export function WeekSummary({
  totalMs,
  segs,
  goals,
  goalsHeaderExtra,
  rangeLabel,
  tracked,
  imported,
  items,
}: {
  totalMs: number;
  segs: WeekSummarySeg[];
  goals: WeekSummaryGoal[];
  // Progress passes its "Manage" link here; History passes nothing.
  goalsHeaderExtra?: ReactNode;
  // Optional caption (Progress This-week tab): week date range + row counts.
  rangeLabel?: string;
  tracked?: number;
  imported?: number;
  // History's week view passes per-category items so rows expand; Progress omits.
  items?: Record<string, CategoryItem[]>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-3 py-5">
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
          <CategoryDonut segs={segs} totalMs={totalMs} items={items} />
        </CardContent>
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
