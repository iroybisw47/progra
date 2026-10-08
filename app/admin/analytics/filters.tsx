import type { DashboardFilters } from "@/lib/admin-dashboard";

// One row of filters above everything, as a plain GET form — no client state,
// a shareable URL, and the server re-renders every chart against the same
// slice. Date presets first (the filter everyone reaches for), then the
// dimensions. `tab` rides along as a hidden field so Apply keeps you where
// you are.
export function Filters({
  filters,
  tab,
  // YYYY-MM-DD from the RPC's generated_at — the page's clock, never
  // Date.now() during render. Null (RPCs not installed) hides the presets.
  today,
}: {
  filters: DashboardFilters;
  tab: string;
  today: string | null;
}) {
  const qs = (over: Partial<Record<string, string | null>>) => {
    const p = new URLSearchParams();
    const put = (k: string, v: string | null | undefined) => {
      if (v) p.set(k, v);
    };
    put("tab", tab);
    put("from", over.from === undefined ? filters.from : over.from);
    put("to", over.to === undefined ? filters.to : over.to);
    put("segment", filters.segment);
    put("cohort_from", filters.cohortFrom);
    put("cohort_to", filters.cohortTo);
    if (filters.includeInternal) p.set("internal", "1");
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  const presets: [string, number][] = [["7d", 7], ["28d", 28], ["90d", 90]];
  const daysAgo = (n: number) => {
    const [y, m, d] = (today as string).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d) - n * 86_400_000).toISOString().slice(0, 10);
  };

  return (
    <form method="get" className="border-hairline flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-xs">
      <input type="hidden" name="tab" value={tab} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption">Range</span>
        {today !== null && presets.map(([label, n]) => (
          <a
            key={label}
            href={qs({ from: daysAgo(n - 1), to: today })}
            className="border-hairline rounded-full border px-2 py-0.5 font-semibold"
          >
            {label}
          </a>
        ))}
        <input type="date" name="from" defaultValue={filters.from ?? ""} className="border-hairline rounded border px-1.5 py-0.5" aria-label="From" />
        <span className="text-caption">to</span>
        <input type="date" name="to" defaultValue={filters.to ?? ""} className="border-hairline rounded border px-1.5 py-0.5" aria-label="To" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="text-caption">Segment</span>
          <select name="segment" defaultValue={filters.segment ?? ""} className="border-hairline rounded border px-1.5 py-0.5">
            <option value="">All</option>
            <option value="uw">UW</option>
            <option value="non_uw">Non-UW</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-caption">Signed up</span>
          <input type="date" name="cohort_from" defaultValue={filters.cohortFrom ?? ""} className="border-hairline rounded border px-1.5 py-0.5" aria-label="Signed up from" />
          <span className="text-caption">–</span>
          <input type="date" name="cohort_to" defaultValue={filters.cohortTo ?? ""} className="border-hairline rounded border px-1.5 py-0.5" aria-label="Signed up to" />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="internal" value="1" defaultChecked={filters.includeInternal} />
          <span>Include internal</span>
        </label>
        <button type="submit" className="bg-brand text-primary-foreground ml-auto rounded-md px-3 py-1 font-semibold">
          Apply
        </button>
      </div>
    </form>
  );
}
