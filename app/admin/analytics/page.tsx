import Link from "next/link";

import { requireAdmin } from "@/lib/auth/require-admin";
import type { DashboardFilters } from "@/lib/admin-dashboard";
import {
  getAdminGhostBehavior,
  getAdminNotificationStats,
  getAdminOnboardingStats,
  getAdminOverview,
  getAdminRoster,
  getAdminUsageSocial,
} from "@/lib/db/admin-analytics";

import { Filters } from "./filters";
import { OnboardingTab } from "./onboarding-tab";
import { OverviewTab } from "./overview-tab";
import { UsageTab } from "./usage-tab";

// The internal analytics dashboard. Admin-only (requireAdmin → 404 for anyone
// else; every RPC re-checks is_admin() itself), reachable only from the
// admin-only Admin hub, never linked from the user UI. Three tabs, each a
// plain query parameter so a view is a URL; one Promise.all per tab, so a tab
// pays only for what it shows. Server-rendered end to end — the client parts
// are the charts (recharts) and the roster's chip row.
//
// Definitions are the plan's (.claude/plans/typed-bubbling-spark.md) and
// lib/telemetry/metrics.ts; the SQL is .claude/plans/analytics/phase4.sql.

const TABS = [
  ["overview", "Overview"],
  ["usage", "Usage & social"],
  ["onboarding", "Onboarding, ghosts & roster"],
] as const;
type Tab = (typeof TABS)[number][0];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateParam = (v: string | undefined): string | null => (v && DATE_RE.test(v) ? v : null);

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const p = await searchParams;
  const tab: Tab = p.tab === "usage" || p.tab === "onboarding" ? p.tab : "overview";
  const filters: DashboardFilters = {
    includeInternal: p.internal === "1",
    segment: p.segment === "uw" || p.segment === "non_uw" ? p.segment : null,
    cohortFrom: dateParam(p.cohort_from),
    cohortTo: dateParam(p.cohort_to),
    from: dateParam(p.from),
    to: dateParam(p.to),
  };
  const [inc, seg, cf, ct] = [filters.includeInternal, filters.segment, filters.cohortFrom, filters.cohortTo];

  let generatedAt: string | null = null;
  let body: React.ReactNode;
  if (tab === "overview") {
    const overview = await getAdminOverview(inc, seg, cf, ct);
    generatedAt = overview?.generated_at ?? null;
    body = <OverviewTab overview={overview} />;
  } else if (tab === "usage") {
    const [usage, notifications] = await Promise.all([
      getAdminUsageSocial(inc, seg, cf, ct, filters.from, filters.to),
      getAdminNotificationStats(inc, seg, cf, ct, filters.from, filters.to),
    ]);
    generatedAt = usage?.generated_at ?? null;
    body = <UsageTab usage={usage} notifications={notifications} />;
  } else {
    const [onboarding, ghosts, roster] = await Promise.all([
      getAdminOnboardingStats(inc, seg, cf, ct),
      getAdminGhostBehavior(inc, seg, cf, ct),
      getAdminRoster(inc, seg, cf, ct),
    ]);
    generatedAt = roster?.generatedAt ?? null;
    body = <OnboardingTab onboarding={onboarding} ghosts={ghosts} roster={roster} />;
  }

  // Tab links keep the filters.
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.segment) query.set("segment", filters.segment);
  if (filters.cohortFrom) query.set("cohort_from", filters.cohortFrom);
  if (filters.cohortTo) query.set("cohort_to", filters.cohortTo);
  if (filters.includeInternal) query.set("internal", "1");
  const hrefFor = (t: Tab) => {
    const q = new URLSearchParams(query);
    if (t !== "overview") q.set("tab", t);
    const s = q.toString();
    return `/admin/analytics${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8 pb-16">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <Link href="/admin" className="text-caption text-xs">
            ← Admin
          </Link>
          <h1 className="text-[26px] font-bold tracking-tight">Analytics</h1>
          <p className="text-caption text-xs">
            {generatedAt ? `Computed ${generatedAt.replace("T", " ").slice(0, 16)} UTC` : "Not available"} · all metrics on read, internal only
          </p>
        </header>

        <Filters filters={filters} tab={tab} today={generatedAt ? generatedAt.slice(0, 10) : null} />

        <nav className="border-hairline -mx-5 flex gap-1 overflow-x-auto border-b px-5 text-sm">
          {TABS.map(([t, label]) => (
            <Link
              key={t}
              href={hrefFor(t)}
              className={
                "-mb-px shrink-0 border-b-2 px-2 py-2 font-semibold " +
                (t === tab ? "border-ink text-ink" : "text-caption border-transparent")
              }
            >
              {label}
            </Link>
          ))}
        </nav>

        {body}
      </main>
    </div>
  );
}
