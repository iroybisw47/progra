import Link from "next/link";

import {
  cohortTable,
  dauSeries,
  groupDaysByUser,
  neverCameBack,
  rollingActive,
  sortUsers,
  sparklineDays,
  type Ratio,
  type UserSort,
} from "@/lib/admin-analytics";
import { requireAdmin } from "@/lib/auth/require-admin";
import { addDaysISO } from "@/lib/dates";
import { listActivityDays, listAnalyticsUsers } from "@/lib/db/admin-analytics";

import { DauChart } from "./charts";
import { CohortTable } from "./cohort-table";
import { UserCard } from "./user-card";

// How much activity to fetch, and how far back cohorts can start. Sixteen
// weeks holds every cohort in the beta so far with room to spare.
const HISTORY_WEEKS = 16;
const COHORT_WEEKS = 9; // W0–W8
const DAU_DAYS = 30;
const SPARKLINE_DAYS = 30;

const SORTS: { key: UserSort; label: string }[] = [
  { key: "active", label: "Did something" },
  { key: "opened", label: "Opened" },
  { key: "joined", label: "Joined" },
];

function Stat({ label, ratio }: { label: string; ratio: Ratio }) {
  const pct = ratio.m === 0 ? null : Math.round((ratio.n / ratio.m) * 100);
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="text-[22px] font-bold tabular-nums">
        {pct === null ? "—" : `${pct}%`}
      </span>
      <span className="text-caption text-[11px] leading-tight">{label}</span>
      <span className="text-caption text-[10px] tabular-nums">
        {ratio.n} / {ratio.m}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <span className="section-label">{title}</span>
      {children}
    </section>
  );
}

// Admin-only analytics: roster, activity, retention. Gated on is_admin() alone —
// unlike /admin it doesn't depend on SOCIAL_ENABLED, since none of this is
// social. Definitions live in lib/admin-analytics.ts and the plan; the numbers
// are only as good as those, so read them before trusting a percentage.
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const me = await requireAdmin();
  const params = await searchParams;
  const sort: UserSort =
    params.sort === "opened" || params.sort === "joined" ? params.sort : "active";

  const [roster, activity] = await Promise.all([
    listAnalyticsUsers(),
    listActivityDays(HISTORY_WEEKS),
  ]);

  if (!roster || !activity) {
    return (
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <div className="w-full max-w-md">
          <p className="text-caption text-sm">
            Analytics unavailable — the analytics RPCs aren&apos;t installed.
          </p>
        </div>
      </div>
    );
  }

  const { users } = roster;
  // The RPC's clock, not Date.now(): one consistent "now" for every relative
  // time on the page, and no impure call in a server component.
  const nowMs = Date.parse(roster.generatedAt);
  // Charts are drawn in the admin's own local days.
  const myToday =
    users.find((u) => u.id === me.id)?.localToday ?? roster.generatedAt.slice(0, 10);
  const since = addDaysISO(myToday, -7 * HISTORY_WEEKS);
  const byUser = groupDaysByUser(activity);

  const active7 = rollingActive(users, 7);
  const active30 = rollingActive(users, 30);
  const gone = neverCameBack(users);
  const excludedNames = users
    .filter((u) => u.excluded)
    .map((u) => u.username ?? u.email ?? u.id.slice(0, 8));

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8 pb-12">
      <main className="flex w-full max-w-md flex-col gap-7">
        <header className="flex flex-col gap-1">
          <Link href="/admin" className="text-caption text-xs">
            ← Admin
          </Link>
          <h1 className="text-[26px] font-bold tracking-tight">Analytics</h1>
          <p className="text-caption text-sm">
            {active7.m} counted {active7.m === 1 ? "user" : "users"} of {users.length}{" "}
            accounts — onboarded, seated, not excluded.
          </p>
        </header>

        <Section title="Retention">
          <div className="flex gap-3">
            <Stat label="Active, last 7 days" ratio={active7} />
            <Stat label="Active, last 30 days" ratio={active30} />
            <Stat label="Never came back" ratio={gone} />
          </div>
          <p className="text-caption text-[11px] leading-snug">
            Active = started a session or ticked a habit, in each user&apos;s own
            timezone. &ldquo;Never came back&rdquo; counts people with nothing
            after their onboarding day, once they&apos;ve had a full day to return.
            {excludedNames.length > 0 && ` Excluded: ${excludedNames.join(", ")}.`}
          </p>
        </Section>

        <Section title={`Daily active, last ${DAU_DAYS} days`}>
          <DauChart series={dauSeries(users, byUser, myToday, DAU_DAYS)} />
        </Section>

        <Section title="Cohorts — % active, by weeks since onboarding">
          <CohortTable rows={cohortTable(users, byUser, since, COHORT_WEEKS)} weeks={COHORT_WEEKS} />
        </Section>

        <Section title={`Everyone (${users.length})`}>
          <div className="flex gap-3 text-xs">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={s.key === "active" ? "/admin/analytics" : `/admin/analytics?sort=${s.key}`}
                className={s.key === sort ? "font-semibold underline underline-offset-4" : "text-caption"}
              >
                {s.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {sortUsers(users, sort).map((u) => (
              <UserCard
                key={u.id}
                user={u}
                nowMs={nowMs}
                sparkline={sparklineDays(byUser.get(u.id), u.localToday, SPARKLINE_DAYS)}
              />
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
