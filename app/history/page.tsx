import { getProfile } from "@/lib/auth/profile";
import {
  addDaysISO,
  mondayOfDateISO,
  startOfMonth,
  todayInTimeZone,
  zonedDayStartMs,
} from "@/lib/dates";
import { computeMonthRollup, computeYearRollup } from "@/lib/db/rollups";
import { computeWeekRecap } from "@/lib/db/recap";
import { listCategories } from "@/lib/db/categories";

import { HistoryClient } from "./history-client";

type SearchParams = Promise<{ view?: string; m?: string; y?: string; w?: string }>;

const CHART_FALLBACK = "var(--chart-5)";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ?view=week&w=YYYY-MM-DD, ?view=month&m=YYYY-MM or ?view=year&y=YYYY.
// Invalid/absent params fall back to the current period silently — /history is
// a browse surface, not a strict data URL (same posture as /recap).
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const now = new Date();
  const view =
    params.view === "year" ? "year" : params.view === "week" ? "week" : "month";
  // Needed by the auto-categorize review popup's inline category picker.
  const categories = await listCategories();

  if (view === "week") {
    // Week boundaries in the user's stored timezone — same anchoring as /recap
    // (app/recap/page.tsx), so the two weekly surfaces agree on what "a week" is.
    const profile = await getProfile();
    const tz = profile?.timezone ?? "UTC";
    const currentMonday = mondayOfDateISO(todayInTimeZone(tz));

    let monday = currentMonday;
    if (params.w && /^\d{4}-\d{2}-\d{2}$/.test(params.w)) {
      monday = mondayOfDateISO(params.w);
    }

    const weekStartMs = zonedDayStartMs(monday, tz);
    const weekEndMs = zonedDayStartMs(addDaysISO(monday, 7), tz) - 1;
    const recap = await computeWeekRecap(weekStartMs, weekEndMs);

    return (
      <HistoryClient
        view="week"
        weekStartMs={weekStartMs}
        weekEndMs={weekEndMs}
        monday={monday}
        totalMs={recap.totalTrackedMs}
        segs={recap.categoryRows.map((r) => ({
          name: r.name,
          color: r.color ?? CHART_FALLBACK,
          ms: r.ms,
        }))}
        goals={recap.goalRows.map((g) => ({
          id: g.id,
          title: g.title,
          quotaHours: g.quotaHours,
          actualMs: g.actualMs,
          status: g.status,
        }))}
        isCurrentPeriod={monday === currentMonday}
        isFuturePeriod={monday > currentMonday}
        prevParam={addDaysISO(monday, -7)}
        nextParam={addDaysISO(monday, 7)}
        categories={categories}
      />
    );
  }

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
        categories={categories}
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
      categories={categories}
    />
  );
}
