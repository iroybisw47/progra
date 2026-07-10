"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react";

import { deleteSession } from "@/app/actions/sessions";
import { excludeEvent } from "@/app/actions/event-exclusions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategorizePeriodButton } from "@/components/categorize-period-button";
import { CategoryMarker } from "@/components/category-marker";
import { SyncCalendarButton } from "@/components/sync-calendar-button";
import { cn } from "@/lib/utils";
import type { CategoryItem } from "@/lib/aggregate";
import type { Rollup } from "@/lib/db/rollups";
import type { Category } from "@/lib/storage";

const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

// Short provenance tag shown next to each item in a category's breakdown.
const SOURCE_LABEL: Record<string, string> = {
  session: "clock",
  goal: "goal",
  rule: "rule",
  manual: "manual",
  ai: "AI",
  uncategorized: "uncat",
};

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

// "Jun 24" — the day an item happened, shown in the expanded breakdown.
// Client-side formatting for the same locale-drift reason as periodLabel.
function itemDate(startMs: number): string {
  return new Date(startMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const label = periodLabel(view, rollup.startMs);

  async function handleDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    // Sessions are our rows — delete for real. Calendar events re-sync from
    // Google, so "delete" = exclusion (hidden from all Progra totals).
    const res =
      pendingDelete.kind === "session"
        ? await deleteSession(pendingDelete.id)
        : await excludeEvent(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
    if ("error" in res) toast.error(res.error);
  }
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
                {rollup.categoryRows.map((row) => {
                  const catKey = row.id ?? "uncategorized";
                  const items = rollup.categoryItems[catKey] ?? [];
                  const isOpen = expandedCategory === catKey;
                  return (
                    <div key={catKey} className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCategory(isOpen ? null : catKey)
                        }
                        aria-expanded={isOpen}
                        disabled={items.length === 0}
                        className="flex items-baseline justify-between gap-2 text-left text-sm disabled:cursor-default"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <CategoryMarker isGoal={row.isGoal} color={row.color} />
                          <span className="truncate">{row.name}</span>
                          {items.length > 0 && (
                            <ChevronDownIcon
                              className={cn(
                                "text-muted-foreground size-3.5 shrink-0 transition-transform",
                                isOpen && "rotate-180"
                              )}
                            />
                          )}
                        </span>
                        <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                          {formatHours(row.ms)}
                        </span>
                      </button>
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
                      {isOpen && items.length > 0 && (
                        <ul className="mt-1 flex max-h-64 flex-col gap-1.5 overflow-y-auto py-1 pl-3.5">
                          {items.map((it) => (
                            <li
                              key={it.id}
                              className="group flex items-baseline justify-between gap-2 text-xs"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                {/* Hover-reveal on pointer devices; always
                                    visible on touch (the PWA has no hover). */}
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete(it)}
                                  aria-label={`Delete ${it.title}`}
                                  className="text-muted-foreground/60 hover:text-foreground -ml-1 shrink-0 self-center transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
                                >
                                  <XIcon className="size-3" />
                                </button>
                                <span className="truncate">{it.title}</span>
                                <span className="text-muted-foreground bg-muted shrink-0 rounded px-1 py-px text-[10px] uppercase tracking-wide">
                                  {SOURCE_LABEL[it.source]}
                                </span>
                              </span>
                              <span className="text-muted-foreground flex shrink-0 items-baseline gap-1.5">
                                <span>{itemDate(it.startMs)}</span>
                                <span className="font-mono tabular-nums">
                                  {formatHours(it.ms)}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                Nothing logged in {label}.
              </p>
            )}

            {/* Calendar actions. Auto-categorize (or review) is period-scoped
                and only shows when there's something to sort/review; Sync Google
                Calendar is global and always available so you can pull events in
                from here. Sync sits directly below the categorize button. */}
            <div className="flex flex-col gap-3">
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
              <SyncCalendarButton />
            </div>

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

        {/* Delete confirm */}
        <Dialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingDelete?.kind === "session"
                  ? "Delete session?"
                  : "Remove event?"}
              </DialogTitle>
              <DialogDescription>
                {pendingDelete?.kind === "session"
                  ? `"${pendingDelete.title}" will be permanently deleted and removed from all totals.`
                  : `"${pendingDelete?.title}" will be hidden from Progra and its totals. The event stays on your Google Calendar.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
