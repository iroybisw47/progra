// Pure derivations for /admin/analytics. No I/O and no Date.now(): every
// "today" arrives from SQL as the user's own local date (`localToday`), and the
// RPC's `generated_at` is the clock for relative times. Dates are YYYY-MM-DD
// strings in the user's timezone, so all arithmetic here is whole days on
// strings via addDaysISO — no DST edge cases, which is why the SQL/TS split
// sits where it does. Reads and mappers live in lib/db/admin-analytics.ts.

import { addDaysISO, mondayOfDateISO } from "@/lib/dates";

export type AnalyticsGoal = {
  id: string;
  // Null when the goal is private — nulled inside the SQL, so a private title
  // never leaves the database, even for the admin.
  title: string | null;
  weeklyQuotaHours: number;
  isPrivate: boolean;
  color: string | null;
};

export type AnalyticsUser = {
  id: string;
  email: string | null;
  signedUpAt: string;
  username: string | null;
  displayName: string | null;
  seatNo: number | null;
  onboardedOn: string | null;
  localToday: string;
  lastSeenAt: string | null;
  // Latest local day with a session start, a manual session end, or a habit
  // tick. Auto-ended sessions contribute only their start: a runaway timer
  // isn't the person.
  lastActiveOn: string | null;
  excluded: boolean;
  goals: AnalyticsGoal[];
};

// One row per (user, local day) with any activity — a session started or a
// habit ticked. Every row is an active day, even with trackedMin 0.
export type ActivityDay = {
  userId: string;
  day: string;
  trackedMin: number;
  habitTicks: number;
};

export type Ratio = { n: number; m: number };

export type UserSort = "active" | "opened" | "joined";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetweenISO(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

// "Today" / "Yesterday" / "4d ago" / "3w ago" — day-grained on purpose, since
// a habit tick only has a date.
export function formatDaysAgo(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// The retention denominator: onboarded, holding a seat (a waitlisted user never
// had access, so can't have churned), and not a demo/owner account.
export function isCounted(u: AnalyticsUser): boolean {
  return u.onboardedOn !== null && u.seatNo !== null && !u.excluded;
}

export function isActiveWithin(u: AnalyticsUser, windowDays: number): boolean {
  if (u.lastActiveOn === null) return false;
  return u.lastActiveOn >= addDaysISO(u.localToday, -(windowDays - 1));
}

export function rollingActive(users: AnalyticsUser[], windowDays: number): Ratio {
  const counted = users.filter(isCounted);
  return {
    n: counted.filter((u) => isActiveWithin(u, windowDays)).length,
    m: counted.length,
  };
}

// Eligible once the whole day after onboarding has elapsed — someone who
// onboarded late last night hasn't had a fair chance to come back yet. Then
// "never came back" = no active day after the onboarding day, so a user who
// only ever did something on day one lands here, deliberately.
export function neverCameBack(users: AnalyticsUser[]): Ratio {
  const eligible = users.filter(
    (u) =>
      isCounted(u) &&
      addDaysISO(u.onboardedOn as string, 2) <= u.localToday
  );
  return {
    n: eligible.filter(
      (u) => u.lastActiveOn === null || u.lastActiveOn <= (u.onboardedOn as string)
    ).length,
    m: eligible.length,
  };
}

export function groupDaysByUser(
  days: ActivityDay[]
): Map<string, Map<string, ActivityDay>> {
  const out = new Map<string, Map<string, ActivityDay>>();
  for (const d of days) {
    let byDay = out.get(d.userId);
    if (!byDay) {
      byDay = new Map();
      out.set(d.userId, byDay);
    }
    byDay.set(d.day, d);
  }
  return out;
}

// Counted users with an active day on each of the `n` days ending at `endDay`.
export function dauSeries(
  users: AnalyticsUser[],
  byUser: Map<string, Map<string, ActivityDay>>,
  endDay: string,
  n: number
): { day: string; count: number }[] {
  const counted = users.filter(isCounted);
  const series: { day: string; count: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDaysISO(endDay, -i);
    const count = counted.filter((u) => byUser.get(u.id)?.has(day)).length;
    series.push({ day, count });
  }
  return series;
}

export type CohortRow = {
  weekOf: string;
  size: number;
  // cells[k] = users active in days [7k, 7k+6] after onboarding, over users for
  // whom that whole window has elapsed. Null when it hasn't elapsed for anyone —
  // blank, never 0%, which is the classic cohort-chart bug.
  cells: (Ratio | null)[];
};

// Cohorts by the Monday of the onboarding week, oldest first. Only users who
// onboarded on or after `since` are included: activity is fetched from `since`
// onward, so an older cohort's early weeks would read as empty and be wrong.
export function cohortTable(
  users: AnalyticsUser[],
  byUser: Map<string, Map<string, ActivityDay>>,
  since: string,
  weeks: number
): CohortRow[] {
  const cohorts = new Map<string, AnalyticsUser[]>();
  for (const u of users) {
    if (!isCounted(u) || (u.onboardedOn as string) < since) continue;
    const key = mondayOfDateISO(u.onboardedOn as string);
    const members = cohorts.get(key) ?? [];
    members.push(u);
    cohorts.set(key, members);
  }

  return [...cohorts.keys()].sort().map((weekOf) => {
    const members = cohorts.get(weekOf) as AnalyticsUser[];
    const cells: (Ratio | null)[] = [];
    for (let k = 0; k < weeks; k++) {
      let n = 0;
      let m = 0;
      for (const u of members) {
        const start = addDaysISO(u.onboardedOn as string, 7 * k);
        const end = addDaysISO(u.onboardedOn as string, 7 * k + 6);
        // Strictly before today: today isn't over, so a window ending today
        // hasn't elapsed.
        if (end >= u.localToday) continue;
        m++;
        const activity = byUser.get(u.id);
        if (!activity) continue;
        for (let i = 0; i <= 6; i++) {
          if (activity.has(addDaysISO(start, i))) {
            n++;
            break;
          }
        }
      }
      cells.push(m === 0 ? null : { n, m });
    }
    return { weekOf, size: members.length, cells };
  });
}

// Dense, zero-filled, oldest first — ready to draw.
export function sparklineDays(
  byDay: Map<string, ActivityDay> | undefined,
  endDay: string,
  n: number
): { day: string; trackedMin: number; habitTicks: number }[] {
  const out: { day: string; trackedMin: number; habitTicks: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDaysISO(endDay, -i);
    const hit = byDay?.get(day);
    out.push({
      day,
      trackedMin: hit?.trackedMin ?? 0,
      habitTicks: hit?.habitTicks ?? 0,
    });
  }
  return out;
}

// Opened the app in the last 7 days but did nothing in the last 7 local days.
// The payoff of tracking both timestamps: it names who's bouncing.
export function isOpeningNotDoing(u: AnalyticsUser, nowMs: number): boolean {
  if (u.lastSeenAt === null) return false;
  if (nowMs - Date.parse(u.lastSeenAt) > 7 * DAY_MS) return false;
  return !isActiveWithin(u, 7);
}

// Newest first, nulls last, then by name so the order is stable across loads.
// Numeric keys, not string compares: the same instant can be written with a
// different offset or precision, and only the parsed value orders correctly.
export function sortUsers(users: AnalyticsUser[], sort: UserSort): AnalyticsUser[] {
  const key = (u: AnalyticsUser): number | null => {
    if (sort === "active") {
      return u.lastActiveOn === null ? null : Date.parse(`${u.lastActiveOn}T00:00:00Z`);
    }
    const at = sort === "opened" ? u.lastSeenAt : u.signedUpAt;
    return at === null ? null : Date.parse(at);
  };
  const name = (u: AnalyticsUser) => u.displayName ?? u.username ?? u.email ?? "";
  return [...users].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) {
      if (ka === null) return 1;
      if (kb === null) return -1;
      return kb - ka;
    }
    return name(a).localeCompare(name(b));
  });
}
