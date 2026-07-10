import { CategoryMarker } from "@/components/category-marker";
import type { CategoryBreakdownRow } from "@/lib/aggregate";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

// The sectioned week breakdown shared by the home "Time this week" card and
// /clock's This week widget: Goals first (starred rows, summed hours in the
// subheading), then Categories. Bars scale against the largest row across
// BOTH sections so lengths stay comparable. History/recap keep their own
// layouts. Callers render their own hero total and empty state.
export function WeekBreakdown({ rows }: { rows: CategoryBreakdownRow[] }) {
  const goalRows = rows.filter((r) => r.isGoal);
  const categoryRows = rows.filter((r) => !r.isGoal);
  const maxMs = rows.reduce((m, r) => Math.max(m, r.ms), 0);

  return (
    <div className="flex flex-col gap-5">
      {goalRows.length > 0 && (
        <Section label="Goals" rows={goalRows} maxMs={maxMs} />
      )}
      {categoryRows.length > 0 && (
        <Section label="Categories" rows={categoryRows} maxMs={maxMs} />
      )}
    </div>
  );
}

function Section({
  label,
  rows,
  maxMs,
}: {
  label: string;
  rows: CategoryBreakdownRow[];
  maxMs: number;
}) {
  const totalMs = rows.reduce((s, r) => s + r.ms, 0);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
        {label} · {formatHours(totalMs)}
      </span>
      {rows.map((row) => (
        <div key={row.id ?? "uncategorized"} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <CategoryMarker isGoal={row.isGoal} color={row.color} />
              {/* Under the Goals subheading the "Goal: " prefix is noise. */}
              <span className="truncate">
                {row.isGoal ? row.name.replace(/^Goal: /, "") : row.name}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
              {formatHours(row.ms)}
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary/60 h-full"
              style={{
                width:
                  maxMs > 0
                    ? `${Math.max(2, (row.ms / maxMs) * 100)}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
