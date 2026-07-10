import { Card, CardContent } from "@/components/ui/card";
import { CategoryMarker } from "@/components/category-marker";
import { GoalProgressBar } from "@/components/goal-progress";
import type { WeekRecap } from "@/lib/db/recap";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

// "Jun 16 – Jun 22, 2026" — collapses month for same-month ranges.
function formatWeekRange(startMs: number, endMs: number): string {
  const startD = new Date(startMs);
  const endD = new Date(endMs);
  const sameYear = startD.getFullYear() === endD.getFullYear();
  const sameMonth = sameYear && startD.getMonth() === endD.getMonth();

  const fmtStart = startD.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const fmtEnd = sameMonth
    ? endD.toLocaleDateString(undefined, { day: "numeric" })
    : endD.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmtStart} – ${fmtEnd}, ${endD.getFullYear()}`;
}

// Pure presentational card designed to look complete as a standalone
// screenshot — controls live outside (in RecapClient). More whitespace
// than other surfaces; calm, non-graded tone is the product requirement.
// Leads with total tracked time across categories; goals are secondary.
export function RecapCard({ recap }: { recap: WeekRecap }) {
  const range = formatWeekRange(recap.weekStartMs, recap.weekEndMs);
  const hasTracked = recap.totalTrackedMs > 0;
  const maxCategoryMs = recap.categoryRows[0]?.ms ?? 0;
  const categoryCount = recap.categoryRows.length;
  const goalCount = recap.goalRows.length;

  const trackedLabel =
    categoryCount === 0
      ? "in total this week"
      : categoryCount === 1
        ? "in total across 1 category"
        : `in total across ${categoryCount} categories`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-8 px-7 py-10 sm:px-9 sm:py-12">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
            Week of
          </span>
          <h2 className="text-lg font-medium tracking-tight">{range}</h2>
        </div>

        {/* Hero — all tracked time (sessions + calendar) */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="font-mono text-5xl tabular-nums tracking-tight">
            {formatHours(recap.totalTrackedMs)}
          </div>
          <div className="text-muted-foreground text-sm">{trackedLabel}</div>
        </div>

        {/* By category — sessions + calendar, incl. Uncategorized. Width
            proportional to the largest category. Descriptive, no quota line. */}
        {categoryCount > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
              By category · {formatHours(recap.totalTrackedMs)}
            </span>
            {recap.categoryRows.map((row) => (
              <div
                key={row.id ?? "uncategorized"}
                className="flex flex-col gap-1"
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 truncate">
                    <CategoryMarker isGoal={row.isGoal} color={row.color} />
                    <span className="truncate">{row.name}</span>
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
                        maxCategoryMs > 0
                          ? `${Math.max(2, (row.ms / maxCategoryMs) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* By goal — quota bars, after the category view */}
        {goalCount > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
              By goal · {formatHours(recap.totalFocusedMs)} focused
            </span>
            {recap.goalRows.map((row) => (
              <GoalProgressBar
                key={row.id}
                title={row.title}
                quotaHours={row.quotaHours}
                actualMs={row.actualMs}
              />
            ))}
          </div>
        )}

        {/* Highlights */}
        {recap.highlights.length > 0 && (
          <div className="flex flex-col items-center gap-1 text-center text-sm">
            {recap.highlights.map((h, i) => (
              <p key={i}>{h}</p>
            ))}
          </div>
        )}

        {/* Closing */}
        <div className="flex flex-col items-center gap-1 pt-2 text-center">
          <p className="text-sm">
            {hasTracked
              ? "That’s a wrap on your week."
              : "A quiet week. Onward."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
