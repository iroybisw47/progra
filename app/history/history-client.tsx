"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategorizePeriodButton } from "@/components/categorize-period-button";
import { cn } from "@/lib/utils";
import type { Rollup } from "@/lib/db/rollups";
import type { Category } from "@/lib/storage";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

type View = "month" | "year";

type Props = {
  view: View;
  rollup: Rollup;
  isCurrentPeriod: boolean;
  isFuturePeriod: boolean;
  prevParam: string;
  nextParam: string;
  categories: Category[];
};

// Labels formatted client-side (locale lives on the client) to avoid SSR
// locale drift — same approach the recap card uses.
function periodLabel(view: View, startMs: number): string {
  const d = new Date(startMs);
  if (view === "year") return String(d.getFullYear());
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function navHref(view: View, param: string): string {
  return view === "year"
    ? `/history?view=year&y=${param}`
    : `/history?view=month&m=${param}`;
}

export function HistoryClient({
  view,
  rollup,
  isCurrentPeriod,
  isFuturePeriod,
  prevParam,
  nextParam,
  categories,
}: Props) {
  const label = periodLabel(view, rollup.startMs);
  const categoryCount = rollup.categoryRows.length;
  const goalCount = rollup.goalRows.length;
  const hasTime = rollup.totalTrackedMs > 0;
  const maxCatMs = rollup.categoryRows[0]?.ms ?? 0;
  const maxGoalMs = rollup.goalRows[0]?.actualMs ?? 0;

  const categoryCountLabel =
    categoryCount === 0
      ? ""
      : categoryCount === 1
        ? "in 1 category"
        : `across ${categoryCount} categories`;

  const currentLabel = view === "year" ? "This year" : "This month";

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="text-muted-foreground text-sm">
            Where your time went, over a longer stretch.
          </p>
        </header>

        {/* Month / Year switch */}
        <div className="bg-muted/50 flex rounded-lg p-1">
          {(["month", "year"] as const).map((v) => (
            <Link
              key={v}
              href={`/history?view=${v}`}
              className={cn(
                "flex-1 rounded-md py-1.5 text-center text-sm capitalize transition-colors",
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </Link>
          ))}
        </div>

        {/* Period scrubber */}
        <div className="flex items-center justify-between">
          <Link
            href={navHref(view, prevParam)}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            aria-label={`Previous ${view}`}
          >
            <ChevronLeftIcon /> Previous
          </Link>
          {isCurrentPeriod || isFuturePeriod ? (
            <span className="text-muted-foreground text-xs">
              {isCurrentPeriod ? currentLabel : ""}
            </span>
          ) : (
            <Link
              href={navHref(view, nextParam)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              aria-label={`Next ${view}`}
            >
              Next <ChevronRightIcon />
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="flex flex-col gap-8 px-6 py-8 sm:px-8">
            {/* Header */}
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
                {view === "year" ? "Year" : "Month"}
              </span>
              <h2 className="text-lg font-medium tracking-tight">{label}</h2>
            </div>

            {/* Hero total — all tracked time (sessions + calendar) */}
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="font-mono text-5xl tabular-nums tracking-tight">
                {formatHours(rollup.totalTrackedMs)}
              </div>
              <div className="text-muted-foreground text-sm">
                {hasTime ? `tracked ${categoryCountLabel}` : "tracked"}
              </div>
            </div>

            {/* By category — sessions + calendar events, incl. Uncategorized.
                Width proportional to the largest category. */}
            {categoryCount > 0 ? (
              <div className="flex flex-col gap-3">
                {rollup.categoryRows.map((row) => (
                  <div
                    key={row.id ?? "uncategorized"}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5 truncate">
                        {row.color && (
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                        )}
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
                            maxCatMs > 0
                              ? `${Math.max(2, (row.ms / maxCatMs) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                Nothing logged in {label}.
              </p>
            )}

            {/* Auto-categorize the period's Uncategorized calendar events, or —
                once none remain — review the AI's past decisions. Hidden for
                future periods and when there's nothing to sort or review. */}
            {!isFuturePeriod &&
              (rollup.uncategorizedEventCount > 0 ||
                rollup.aiCategorizedEventCount > 0) && (
                <CategorizePeriodButton
                  startMs={rollup.startMs}
                  endMs={rollup.endMs}
                  uncategorizedCount={rollup.uncategorizedEventCount}
                  reviewCount={rollup.aiCategorizedEventCount}
                  categories={categories}
                />
              )}

            {/* By goal — the committed-work subset (clocked-in, goal-attributed) */}
            {goalCount > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
                  By goal
                </span>
                {rollup.goalRows.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{row.title}</span>
                      <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                        {formatHours(row.actualMs)}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary/60 h-full"
                        style={{
                          width:
                            maxGoalMs > 0
                              ? `${Math.max(2, (row.actualMs / maxGoalMs) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sessions micro-row */}
            {rollup.sessionsCompleted > 0 && (
              <div className="text-muted-foreground flex flex-col items-center gap-1 text-center text-sm">
                <span>
                  {rollup.sessionsCompleted}{" "}
                  {rollup.sessionsCompleted === 1 ? "session" : "sessions"}{" "}
                  clocked in
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
