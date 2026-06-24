import { startOfMonth } from "@/lib/dates";
import { computeMonthRollup, computeYearRollup } from "@/lib/db/rollups";

import { HistoryClient } from "./history-client";

type SearchParams = Promise<{ view?: string; m?: string; y?: string }>;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ?view=month&m=YYYY-MM or ?view=year&y=YYYY. Invalid/absent params fall back
// to the current month silently — /history is a browse surface, not a strict
// data URL (same posture as /recap).
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const now = new Date();
  const view = params.view === "year" ? "year" : "month";

  if (view === "year") {
    let year = now.getFullYear();
    if (params.y && /^\d{4}$/.test(params.y)) year = Number(params.y);

    const anchor = new Date(year, 0, 1);
    const rollup = await computeYearRollup(anchor);

    const isCurrent = year === now.getFullYear();
    const isFuture = year > now.getFullYear();

    return (
      <HistoryClient
        view="year"
        rollup={rollup}
        isCurrentPeriod={isCurrent}
        isFuturePeriod={isFuture}
        prevParam={String(year - 1)}
        nextParam={String(year + 1)}
      />
    );
  }

  // Month view (default).
  let anchor = startOfMonth(now);
  if (params.m && /^\d{4}-\d{2}$/.test(params.m)) {
    const [y, m] = params.m.split("-").map(Number);
    if (m >= 1 && m <= 12) anchor = new Date(y, m - 1, 1);
  }

  const rollup = await computeMonthRollup(anchor);

  const currentMonthStart = startOfMonth(now);
  const isCurrent = anchor.getTime() === currentMonthStart.getTime();
  const isFuture = anchor.getTime() > currentMonthStart.getTime();

  const prev = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  const monthParam = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

  return (
    <HistoryClient
      view="month"
      rollup={rollup}
      isCurrentPeriod={isCurrent}
      isFuturePeriod={isFuture}
      prevParam={monthParam(prev)}
      nextParam={monthParam(next)}
    />
  );
}
