import { addDaysISO, isoDateInTimeZone, mondayOfDateISO, zonedDayStartMs } from "@/lib/dates";
import { entityColor, goalColorOf } from "@/lib/colors";
import { sessionAttributionEnd, sessionWorkedMs } from "@/lib/session";
import type { Goal } from "@/lib/db/goals";
import type { Habit, HabitCompletion as HabitCheck } from "@/lib/db/habits";
import type { Session } from "@/lib/storage";

// The two History sections the month/year rollups don't cover: how often each
// goal's weekly quota was actually met over a window, and how consistently each
// habit was checked off. Pure functions over already-fetched rows — the reads
// live in lib/db/history-stats.ts, the same split lib/aggregate.ts keeps from
// lib/db/rollups.ts.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type GoalCompletionRow = {
  id: string;
  title: string;
  color: string;
  // Mean of each eligible week's credit, 0–1. A week earns how close it got to
  // quota, capped at 1 — see goalCompletionFrom.
  rate: number;
  // Hours that COUNTED toward the quota: Σ min(weekMs, quotaMs). Capped the same
  // way `rate` is, so "20/40h" and "50%" can never contradict each other on the
  // same row.
  countedMs: number;
  // What those hours were measured against: quota × eligible weeks.
  targetMs: number;
  // Weeks the goal was actually eligible for — see goalCompletionFrom.
  weeksEligible: number;
};

export type GoalCompletion = {
  // Completed-or-current weeks overlapping the window. Headline denominator.
  weeksElapsed: number;
  // Σ weeksMet ÷ Σ weeksEligible, 0–1. 0 when nothing is eligible.
  overallRate: number;
  perGoal: GoalCompletionRow[];
};

export type HabitRateRow = {
  id: string;
  name: string;
  color: string;
  // 0–1 over the days the habit existed inside the window.
  rate: number;
};

export type HabitCalendarDay = {
  date: string; // YYYY-MM-DD
  done: number;
  // Habits alive that day — the denominator the cell's fill is scaled against.
  total: number;
};

export type HabitCompletion = {
  overallRate: number;
  perHabit: HabitRateRow[];
  // Month scope only; empty for year scope. Stops at today.
  calendar: HabitCalendarDay[];
};

// Mondays (YYYY-MM-DD) of every week that overlaps [startMs, endMs], stopping at
// the week containing `now` — a window running into the future (the current
// month, the current year) must not count weeks that haven't happened yet.
export function weekMondaysInRange(
  startMs: number,
  endMs: number,
  tz: string,
  now: number
): string[] {
  if (now < startMs) return [];
  const firstMonday = mondayOfDateISO(isoDateInTimeZone(startMs, tz));
  const lastMonday = mondayOfDateISO(
    isoDateInTimeZone(Math.min(endMs, now), tz)
  );
  if (lastMonday < firstMonday) return [];
  const out: string[] = [];
  for (let m = firstMonday; m <= lastMonday; m = addDaysISO(m, 7)) out.push(m);
  return out;
}

// Inclusive day count between two YYYY-MM-DD strings. UTC arithmetic, so a
// local-tz reading can't shift the span by a day.
export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS) + 1;
}

// Per-goal quota attainment across a window.
//
// Scoring is PARTIAL, not all-or-nothing: a week earns min(1, hours / quota),
// and a goal's rate is the mean of its eligible weeks. 10h against a 20h quota
// is half a week's credit, not zero. The per-week cap is what keeps the mean
// meaningful — without it a single 40h week would cancel four empty ones.
//
// Attribution matches lib/aggregate.ts exactly — a session lands in the week
// containing its ATTRIBUTION END, not its start — so a goal's History hours
// reconcile with the same goal's weekly recap and quota bar. The handoff spec
// asked for start-based bucketing; following it would have made this screen
// disagree with /recap for any session crossing midnight into a new week.
//
// Eligibility: a goal is only measured from the week it was created. Quotas have
// no history (a goal carries one current `weekly_quota_hours`), so measuring a
// goal added in May against January would read as having missed months it did
// not exist for. Counting from creation is the honest denominator available.
//
// Archived goals are excluded, even from past windows the handoff spec wanted
// them in. "Delete" in the UI only sets `status = 'archived'` — so to the user
// the goal is gone, and scoring a goal they deleted (and dragging `overallRate`
// down with it) reads as a bug. Their hours still show in the Time breakdown,
// which is about where time went, not about who's hitting quota.
export function goalCompletionFrom(
  goals: Goal[],
  sessions: Session[],
  opts: { startMs: number; endMs: number; tz: string; now: number }
): GoalCompletion {
  const { startMs, endMs, tz, now } = opts;
  const weeks = weekMondaysInRange(startMs, endMs, tz, now);
  if (weeks.length === 0) return { weeksElapsed: 0, overallRate: 0, perGoal: [] };

  const quotaGoals = goals.filter(
    (g) => g.status === "active" && g.weeklyQuotaHours > 0
  );
  if (quotaGoals.length === 0) {
    return { weeksElapsed: weeks.length, overallRate: 0, perGoal: [] };
  }

  // Week bounds, precomputed once — zonedDayStartMs is an Intl round-trip and
  // the session loop would otherwise redo it per row.
  const bounds = weeks.map((monday) => ({
    monday,
    startMs: zonedDayStartMs(monday, tz),
    endMs: zonedDayStartMs(addDaysISO(monday, 7), tz) - 1,
  }));

  // Past windows cap "now" at the window end, so a session still running into
  // the window counts up to the end rather than being clipped — the same
  // treatment computeRollup and the recap apply.
  const attributionNow = Math.min(now, endMs);
  const perGoalWeek = new Map<string, Map<string, number>>(); // goalId -> monday -> ms
  for (const s of sessions) {
    if (s.goalId === null) continue;
    const ms = sessionWorkedMs(s, attributionNow);
    if (ms <= 0) continue;
    const end = sessionAttributionEnd(s, attributionNow);
    const week = bounds.find((b) => end >= b.startMs && end <= b.endMs);
    if (!week) continue;
    let byWeek = perGoalWeek.get(s.goalId);
    if (!byWeek) {
      byWeek = new Map();
      perGoalWeek.set(s.goalId, byWeek);
    }
    byWeek.set(week.monday, (byWeek.get(week.monday) ?? 0) + ms);
  }

  let totalCredit = 0;
  let totalEligible = 0;
  const perGoal: GoalCompletionRow[] = quotaGoals.map((g) => {
    const createdMonday = mondayOfDateISO(isoDateInTimeZone(g.createdAt, tz));
    const eligible = weeks.filter((m) => m >= createdMonday);
    const byWeek = perGoalWeek.get(g.id);
    const quotaMs = g.weeklyQuotaHours * HOUR_MS;

    // Each week earns partial credit for how close it got, capped at 1. Scoring
    // a week all-or-nothing made 10h of a 20h quota worth exactly as much as
    // not showing up; the cap is what stops one 40h week from offsetting four
    // empty ones, so the mean still reads as "how consistently did I hit it".
    let credit = 0;
    let countedMs = 0;
    for (const m of eligible) {
      const ms = byWeek?.get(m) ?? 0;
      const counted = Math.min(ms, quotaMs);
      countedMs += counted;
      credit += counted / quotaMs;
    }
    totalCredit += credit;
    totalEligible += eligible.length;

    return {
      id: g.id,
      title: g.title,
      color: goalColorOf(g),
      rate: eligible.length > 0 ? credit / eligible.length : 0,
      countedMs,
      targetMs: quotaMs * eligible.length,
      weeksEligible: eligible.length,
    };
  });

  return {
    weeksElapsed: weeks.length,
    overallRate: totalEligible > 0 ? totalCredit / totalEligible : 0,
    // Goals that never became eligible in this window (created after it ended)
    // are noise, not signal.
    perGoal: perGoal
      .filter((r) => r.weeksEligible > 0)
      .sort((a, b) => b.rate - a.rate),
  };
}

// Per-habit consistency across a window, plus (month scope) a per-day count.
//
// Denominator note: habits carry no schedule in this schema — just created_at
// and archived_at — so there is no "scheduled days" to divide by as the handoff
// spec assumed. Every habit is treated as daily, and the denominator is the days
// the habit actually existed inside the window, capped at today. A habit created
// mid-month is therefore not punished for the days before it existed.
//
// Archived habits are excluded, for the same reason archived goals are: the UI
// calls it "Delete" and only stamps `archived_at`, so a habit the user deleted
// must not keep scoring — including in the calendar's per-day totals and its
// "of N" caption.
export function habitCompletionFrom(
  habits: Habit[],
  checks: HabitCheck[],
  opts: {
    startISO: string;
    endISO: string;
    todayISO: string;
    tz: string;
    includeCalendar: boolean;
  }
): HabitCompletion {
  const { startISO, endISO, todayISO, tz, includeCalendar } = opts;
  // Nothing has happened after today, so never count past it.
  const lastISO = endISO < todayISO ? endISO : todayISO;
  const empty: HabitCompletion = { overallRate: 0, perHabit: [], calendar: [] };
  const live = habits.filter((h) => h.archivedAt === null);
  if (lastISO < startISO || live.length === 0) return empty;

  // Each habit's own window: [created, today] clipped to [start, last].
  const spans = live.map((h) => {
    // `completed_on` is a local calendar date, so a habit's own bounds have to
    // be read in the same timezone or one created late in the evening reads as
    // a day late.
    const created = isoDateInTimeZone(h.createdAt, tz);
    const from = created > startISO ? created : startISO;
    // Every habit here is live, so its span runs to the end of the window —
    // only the creation date can clip it.
    const to = lastISO;
    return { habit: h, from, to, days: to < from ? 0 : daysBetween(from, to) };
  });

  const checksByHabit = new Map<string, Set<string>>();
  for (const c of checks) {
    let set = checksByHabit.get(c.habitId);
    if (!set) {
      set = new Set();
      checksByHabit.set(c.habitId, set);
    }
    set.add(c.completedOn);
  }

  let totalChecks = 0;
  let totalDays = 0;
  const perHabit: HabitRateRow[] = [];
  for (const span of spans) {
    if (span.days === 0) continue;
    // Only count checks inside the habit's own span — a completion row dated
    // before it existed shouldn't push a rate over 100%.
    const checked = Array.from(checksByHabit.get(span.habit.id) ?? []).filter(
      (d) => d >= span.from && d <= span.to
    ).length;
    totalChecks += checked;
    totalDays += span.days;
    perHabit.push({
      id: span.habit.id,
      name: span.habit.name,
      color: entityColor(span.habit.color),
      rate: checked / span.days,
    });
  }

  const calendar: HabitCalendarDay[] = [];
  if (includeCalendar) {
    for (let d = startISO; d <= lastISO; d = addDaysISO(d, 1)) {
      const alive = spans.filter((s) => s.days > 0 && d >= s.from && d <= s.to);
      const done = alive.filter((s) =>
        checksByHabit.get(s.habit.id)?.has(d)
      ).length;
      calendar.push({ date: d, done, total: alive.length });
    }
  }

  return {
    overallRate: totalDays > 0 ? totalChecks / totalDays : 0,
    perHabit: perHabit.sort((a, b) => b.rate - a.rate),
    calendar,
  };
}
