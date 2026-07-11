"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatLocalDate, formatRelativeDay } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";
import { useNow } from "@/lib/hooks";
import { sessionPausedMs, sessionWorkedMs } from "@/lib/session";
import type { Category, Session } from "@/lib/storage";
import type { HistoryItem } from "@/lib/db/history";

import { loadSessionHistory } from "@/app/actions/sessions";

// "all" = every category, "none" = the Uncategorized bucket, else a category id.
type Filter = "all" | "none" | string;

type Props = {
  categories: Category[];
  initialItems: HistoryItem[];
  pageSize: number;
};

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Worked duration for a completed session. endedAt is non-null in history, so
// passing it as `now` yields the final worked time (no in-progress pause).
function workedOf(s: Session): number {
  return sessionWorkedMs(s, s.endedAt ?? s.startedAt);
}

function itemStartMs(item: HistoryItem): number {
  return item.kind === "session" ? item.session.startedAt : item.event.startMs;
}

// Time counted toward the day total: worked time for sessions, full span for
// calendar events (excluded events never reach this surface).
function itemDurationMs(item: HistoryItem): number {
  return item.kind === "session"
    ? workedOf(item.session)
    : item.event.endMs - item.event.startMs;
}

export function SessionsClient({ categories, initialItems, pageSize }: Props) {
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<HistoryItem[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length >= pageSize);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const categoryById = new Map(categories.map((c) => [c.id, c] as const));
  function categoryName(id: string | null): string {
    if (id === null) return "Uncategorized";
    return categoryById.get(id)?.name ?? "Uncategorized";
  }

  function filterArg(f: Filter): string | "none" | null {
    if (f === "all") return null;
    if (f === "none") return "none";
    return f;
  }

  function applyFilter(next: Filter) {
    if (next === filter) return;
    setFilter(next);
    setLoading(true);
    startTransition(async () => {
      const rows = await loadSessionHistory({ categoryId: filterArg(next) });
      setItems(rows);
      setHasMore(rows.length >= pageSize);
      setLoading(false);
    });
  }

  function loadMore() {
    const oldest = items[items.length - 1];
    if (!oldest) return;
    setLoading(true);
    startTransition(async () => {
      const rows = await loadSessionHistory({
        categoryId: filterArg(filter),
        beforeMs: itemStartMs(oldest),
      });
      if (rows.length === 0) {
        setHasMore(false);
      } else {
        setItems((cur) => [...cur, ...rows]);
        setHasMore(rows.length >= pageSize);
      }
      setLoading(false);
    });
  }

  // Group the (already newest-first) items by local day, preserving order.
  const groups: { key: string; date: Date; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const d = new Date(itemStartMs(item));
    const key = formatLocalDate(d);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, date: d, items: [item] });
  }

  // Real current time for relative day labels (Today/Yesterday). useNow returns
  // 0 until hydration; before then labels render as absolute dates, then correct.
  const nowForLabels = new Date(now);

  const chips: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    ...categories.map((c) => ({ value: c.id as Filter, label: c.name })),
    { value: "none", label: "Uncategorized" },
  ];

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Session history
          </h1>
          <p className="text-muted-foreground text-sm">
            Past sessions and calendar events, newest first.
          </p>
        </header>

        {/* Category filter chips */}
        <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => applyFilter(chip.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                filter === chip.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-10">
              <p className="text-muted-foreground text-center text-sm">
                No past sessions{filter !== "all" ? " in this category" : ""} yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => {
              const dayTotal = group.items.reduce(
                (s, x) => s + itemDurationMs(x),
                0
              );
              return (
                <div key={group.key} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-medium">
                      {formatRelativeDay(group.date, nowForLabels)}
                    </h2>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {formatDuration(dayTotal)}
                    </span>
                  </div>
                  <Card>
                    <CardContent className="flex flex-col divide-y divide-border p-0">
                      {group.items.map((item) => {
                        if (item.kind === "event") {
                          const e = item.event;
                          return (
                            <div
                              key={`e-${e.id}`}
                              className="flex flex-col gap-1 px-4 py-3"
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-sm font-medium">
                                  {e.title ?? "(no title)"}
                                </span>
                                <span className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
                                  {formatDuration(e.endMs - e.startMs)}
                                </span>
                              </div>
                              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                <span>
                                  {formatClock(e.startMs)} –{" "}
                                  {formatClock(e.endMs)}
                                </span>
                                <Badge variant="secondary" className="h-5">
                                  {e.category?.name ?? "Uncategorized"}
                                </Badge>
                                <Badge variant="outline" className="h-5">
                                  Calendar
                                </Badge>
                              </div>
                            </div>
                          );
                        }

                        const s = item.session;
                        const paused = sessionPausedMs(s, s.endedAt ?? s.startedAt);
                        return (
                          <div
                            key={`s-${s.id}`}
                            className="flex flex-col gap-1 px-4 py-3"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {s.taskName}
                              </span>
                              <span className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
                                {formatDuration(workedOf(s))}
                              </span>
                            </div>
                            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <span>
                                {formatClock(s.startedAt)} –{" "}
                                {s.endedAt ? formatClock(s.endedAt) : ""}
                              </span>
                              <Badge variant="secondary" className="h-5">
                                {categoryName(s.categoryId)}
                              </Badge>
                              {paused > 0 && (
                                <span>paused {formatDuration(paused)}</span>
                              )}
                            </div>
                            {s.description && (
                              <p className="text-muted-foreground mt-0.5 text-sm whitespace-pre-wrap">
                                {s.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              );
            })}

            {hasMore && (
              <Button
                variant="outline"
                className="h-10 w-full"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load older"}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
