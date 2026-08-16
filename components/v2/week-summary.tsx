import type { ReactNode } from "react";

import { CategoryDonut } from "@/components/v2/category-donut";
import { GoalQuotaRows } from "@/components/v2/goal-quota-rows";
import type { CategoryItem } from "@/lib/aggregate";

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
      <div className="flex flex-col gap-3">
        {rangeLabel && (
          <div className="flex items-baseline justify-between">
            <span className="section-label">This week · {rangeLabel}</span>
            <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
              {tracked ?? 0} tracked · {imported ?? 0} imported
            </span>
          </div>
        )}
        <CategoryDonut segs={segs} totalMs={totalMs} items={items} />
      </div>

      {goals.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center gap-[7px]">
            <span className="section-label">Goal quotas</span>
            <span className="flex-1" />
            {goalsHeaderExtra}
          </div>
          <GoalQuotaRows goals={goals} />
        </section>
      )}
    </div>
  );
}
