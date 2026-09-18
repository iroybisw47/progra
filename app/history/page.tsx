import { getProfile } from "@/lib/auth/profile";
import {
  addDaysISO,
  mondayOfDateISO,
  todayInTimeZone,
  zonedDayStartMs,
} from "@/lib/dates";
import {
  computeGoalCompletion,
  computeHabitCompletion,
  type GoalCompletion,
  type HabitCompletion,
} from "@/lib/db/history-stats";
import { computeMonthRollup, computeYearRollup, type Rollup } from "@/lib/db/rollups";
import { computeWeekRecap } from "@/lib/db/recap";

import { HistoryClient } from "./history-client";

// The current period (month/year/week) is derived from the live clock at render
// time. Force per-request rendering so the route output is never cached/frozen —
// otherwise a stale full-route-cache entry pins "now" to build time.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  view?: string;
  m?: string;
  y?: string;
  w?: string;
}>;

const CHART_FALLBACK = "var(--chart-5)";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Progra's first year — the repo's initial commit is May 2026 and no row
// predates it, so every earlier period is guaranteed empty. The steppers stop
// here and out-of-range params are clamped to it rather than rendering an empty
// 2019 nobody can explain.
const MIN_YEAR = 2026;
// The week containing 1 Jan (a Thursday in 2026), so no day of the first year
// is unreachable from the week scope.
const MIN_WEEK_MONDAY = mondayOfDateISO(`${MIN_YEAR}-01-01`);

// The goal/habit sections that sit under the time breakdown. Fired AFTER the
// rollup rather than alongside it on purpose: computeGoalCompletion asks for
// `listSessionsInRange(startMs, endMs)` with the window the rollup just read,
// so the cache()d loader returns the same rows instead of a second round-trip.
async function loadCompletions(
  rollup: Rollup,
  tz: string,
  todayISO: string,
  includeCalendar: boolean
): Promise<{ goalCompletion: GoalCompletion; habitCompletion: HabitCompletion }> {
  const [goalCompletion, habitCompletion] = await Promise.all([
    computeGoalCompletion(rollup.startMs, rollup.endMs, tz),
    computeHabitCompletion(
      rollup.startMs,
      rollup.endMs,
      todayISO,
      tz,
      includeCalendar
    ),
  ]);
  return { goalCompletion, habitCompletion };
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
  const view =
    params.view === "year" ? "year" : params.view === "week" ? "week" : "month";
  // "Now" is anchored in the user's stored timezone for EVERY period (the week
  // already did this). Server-local time is UTC on Vercel; building a period
  // anchor from server-UTC midnight and then formatting it in a browser west of
  // UTC rolls the label back a day → the month/year label shows the wrong
  // month/year on the client. Deriving the current year/month here and passing
  // them as numbers keeps label construction + formatting in one (client) tz.
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const today = todayInTimeZone(tz); // YYYY-MM-DD in the user's tz
  const [curYear, curMonth] = today.split("-").map(Number); // curMonth is 1-indexed

  if (view === "week") {
    const currentMonday = mondayOfDateISO(today);
    let monday = currentMonday;
    if (params.w && /^\d{4}-\d{2}-\d{2}$/.test(params.w)) {
      monday = mondayOfDateISO(params.w);
    }
    // Never before the app's first week.
    if (monday < MIN_WEEK_MONDAY) monday = MIN_WEEK_MONDAY;

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
          id: r.id,
          name: r.name,
          color: r.color ?? CHART_FALLBACK,
          ms: r.ms,
        }))}
        items={recap.categoryItems}
        goals={recap.goalRows.map((g) => ({
          id: g.id,
          title: g.title,
          quotaHours: g.quotaHours,
          actualMs: g.actualMs,
          status: g.status,
        }))}
        isCurrentPeriod={monday === currentMonday}
        isFuturePeriod={monday > currentMonday}
        isEarliestPeriod={monday <= MIN_WEEK_MONDAY}
        prevParam={addDaysISO(monday, -7)}
        nextParam={addDaysISO(monday, 7)}
      />
    );
  }

  if (view === "year") {
    let year = curYear;
    if (params.y && /^\d{4}$/.test(params.y)) year = Number(params.y);
    if (year < MIN_YEAR) year = MIN_YEAR;

    const rollup = await computeYearRollup(new Date(year, 0, 1));
    const { goalCompletion, habitCompletion } = await loadCompletions(
      rollup,
      tz,
      today,
      false // no calendar grid in year scope
    );

    // "Jan – Sep" for the year in progress, "Jan – Dec" once it's over.
    const rangeLabel = `Jan – ${
      year === curYear ? MONTH_ABBR[curMonth - 1] : "Dec"
    }`;

    return (
      <HistoryClient
        view="year"
        rollup={rollup}
        year={year}
        goalCompletion={goalCompletion}
        habitCompletion={habitCompletion}
        rangeLabel={rangeLabel}
        scopeYearHref={`/history?view=year&y=${year}`}
        // Switching to Month lands on the live month of the year in view, or
        // December for a year that's already over.
        scopeMonthHref={`/history?view=month&m=${year}-${pad2(
          year === curYear ? curMonth : 12
        )}`}
        isCurrentPeriod={year === curYear}
        isFuturePeriod={year > curYear}
        isEarliestPeriod={year <= MIN_YEAR}
        prevParam={String(year - 1)}
        nextParam={String(year + 1)}
      />
    );
  }

  // Month view (default). y/m are 1-indexed; monthIndex (0-indexed) is passed to
  // the client so the label is built and formatted entirely client-side.
  let y = curYear;
  let m = curMonth;
  if (params.m && /^\d{4}-\d{2}$/.test(params.m)) {
    const [py, pm] = params.m.split("-").map(Number);
    if (pm >= 1 && pm <= 12) {
      y = py;
      m = pm;
    }
  }
  // Never before Jan of the app's first year.
  if (y < MIN_YEAR) {
    y = MIN_YEAR;
    m = 1;
  }

  const rollup = await computeMonthRollup(new Date(y, m - 1, 1));
  const { goalCompletion, habitCompletion } = await loadCompletions(
    rollup,
    tz,
    today,
    true // month scope shows the per-day habit calendar
  );

  const isCurrent = y === curYear && m === curMonth;
  const isFuture = y > curYear || (y === curYear && m > curMonth);
  const prev = new Date(y, m - 2, 1); // 0-indexed (m-1) minus one month
  const next = new Date(y, m, 1); // 0-indexed month index m == next month
  const monthParam = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

  return (
    <HistoryClient
      view="month"
      rollup={rollup}
      year={y}
      monthIndex={m - 1}
      goalCompletion={goalCompletion}
      habitCompletion={habitCompletion}
      rangeLabel={MONTH_ABBR[m - 1]}
      scopeYearHref={`/history?view=year&y=${y}`}
      scopeMonthHref={`/history?view=month&m=${monthParam(new Date(y, m - 1, 1))}`}
      isCurrentPeriod={isCurrent}
      isFuturePeriod={isFuture}
      isEarliestPeriod={y === MIN_YEAR && m === 1}
      prevParam={monthParam(prev)}
      nextParam={monthParam(next)}
    />
  );
}
