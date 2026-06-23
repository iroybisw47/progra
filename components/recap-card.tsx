import { Card, CardContent } from "@/components/ui/card";
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
export function RecapCard({ recap }: { recap: WeekRecap }) {
  const goalCount = recap.goalRows.length;
  const range = formatWeekRange(recap.weekStartMs, recap.weekEndMs);
  const hasFocus = recap.totalFocusedMs > 0;

  const goalCountLabel =
    goalCount === 0
      ? "no active goals"
      : goalCount === 1
        ? "across 1 goal"
        : `across ${goalCount} goals`;

  // Only show non-zero block counts — keeps the "didn't happen" line out of
  // the recap when there's nothing to mention.
  const blockSegments: string[] = [];
  if (recap.blocksDone > 0) {
    blockSegments.push(`${recap.blocksDone} done`);
  }
  if (recap.blocksMoved > 0) {
    blockSegments.push(`${recap.blocksMoved} re-slotted`);
  }
  if (recap.blocksMissed > 0) {
    blockSegments.push(
      `${recap.blocksMissed} didn't happen`
    );
  }

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

        {/* Hero */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="font-mono text-5xl tabular-nums tracking-tight">
            {formatHours(recap.totalFocusedMs)}
          </div>
          <div className="text-muted-foreground text-sm">
            focused {goalCountLabel}
          </div>
        </div>

        {/* Per-goal bars */}
        {goalCount > 0 && (
          <div className="flex flex-col gap-3">
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

        {/* Counts micro-row */}
        {(recap.sessionsCompleted > 0 ||
          recap.habitChecks > 0 ||
          blockSegments.length > 0) && (
          <div className="text-muted-foreground flex flex-col items-center gap-1 text-center text-sm">
            {(recap.sessionsCompleted > 0 || recap.habitChecks > 0) && (
              <span>
                {recap.sessionsCompleted > 0 && (
                  <>
                    {recap.sessionsCompleted}{" "}
                    {recap.sessionsCompleted === 1 ? "session" : "sessions"}
                  </>
                )}
                {recap.sessionsCompleted > 0 && recap.habitChecks > 0 && (
                  <> · </>
                )}
                {recap.habitChecks > 0 && (
                  <>
                    {recap.habitChecks} habit{" "}
                    {recap.habitChecks === 1 ? "check" : "checks"}
                  </>
                )}
              </span>
            )}
            {blockSegments.length > 0 && (
              <span>{blockSegments.join(" · ")}</span>
            )}
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
            {hasFocus
              ? "That’s a wrap on your week."
              : "A quiet week. Onward."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
