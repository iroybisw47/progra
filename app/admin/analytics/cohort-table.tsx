import type { CohortRow } from "@/lib/admin-analytics";

// Weeks after onboarding across the top, onboarding week down the side. Each
// cell shows the % and the raw n/m, because m is often under ten and a bare
// percentage would overstate how much a single person moves it. Blank means
// the window hasn't finished for anyone in the cohort yet — not 0%.
export function CohortTable({ rows, weeks }: { rows: CohortRow[]; weeks: number }) {
  if (rows.length === 0) {
    return (
      <p className="text-caption text-sm">
        No cohorts yet — nobody counted has onboarded inside the window.
      </p>
    );
  }

  return (
    // Can't fit a phone at W0–W8, so it scrolls inside itself; the page never
    // scrolls sideways.
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-max border-collapse text-xs tabular-nums">
        <thead>
          <tr className="text-caption">
            <th className="py-1.5 pr-3 text-left font-semibold">Week of</th>
            <th className="py-1.5 pr-3 text-right font-semibold">n</th>
            {Array.from({ length: weeks }, (_, k) => (
              <th key={k} className="w-12 py-1.5 text-center font-semibold">
                W{k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.weekOf} className="border-hairline border-t">
              <td className="py-1.5 pr-3 font-medium">{row.weekOf.slice(5)}</td>
              <td className="text-caption py-1.5 pr-3 text-right">{row.size}</td>
              {row.cells.map((cell, k) => {
                if (cell === null) return <td key={k} className="py-1.5" />;
                const pct = Math.round((cell.n / cell.m) * 100);
                return (
                  <td key={k} className="py-1.5 text-center">
                    <span
                      className="inline-flex flex-col items-center rounded px-1 py-0.5"
                      // Shade by retention so the cohort shape reads at a glance.
                      style={{
                        backgroundColor: `color-mix(in oklab, var(--brand) ${Math.round(pct * 0.35)}%, transparent)`,
                      }}
                    >
                      <span className="font-semibold">{pct}%</span>
                      <span className="text-caption text-[9px]">
                        {cell.n}/{cell.m}
                      </span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
