"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventCategoryDialog } from "@/components/event-category-dialog";
import { SyncCalendarButton } from "@/components/sync-calendar-button";
import { WeekStrip } from "@/components/week-strip";
import { useNow } from "@/lib/hooks";
import type { Category } from "@/lib/storage";
import type { DayEvent } from "@/lib/db/calendar-events";
import { formatLocalDate, formatLongDate } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";

type CalendarClientProps = {
  events: DayEvent[];
  categories: Category[];
};

function formatTimeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CalendarClient({ events, categories }: CalendarClientProps) {
  const now = useNow();
  const [dialogEvent, setDialogEvent] = useState<DayEvent | null>(null);
  const hydrated = now !== 0;
  const today = new Date(hydrated ? now : 0);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const selectedDate = selectedTs !== null ? new Date(selectedTs) : today;
  const selectedKey =
    hydrated || selectedTs !== null ? formatLocalDate(selectedDate) : "";
  const todayKey = hydrated ? formatLocalDate(today) : "";

  // Mark every day in the window that has at least one event.
  const markedDates = new Set(
    events.map((e) => formatLocalDate(new Date(e.startMs)))
  );

  // Attribution: event shown on the local-day of its start time. Events
  // spanning midnight only appear on their start day for v1.
  const dayEvents = events
    .filter((e) => formatLocalDate(new Date(e.startMs)) === selectedKey)
    .sort((a, b) => a.startMs - b.startMs);

  const totalMs = dayEvents.reduce((sum, e) => sum + (e.endMs - e.startMs), 0);

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          {hydrated ? (
            <WeekStrip
              selectedDate={selectedDate}
              today={today}
              onSelect={(d) => setSelectedTs(d.getTime())}
              markedDates={markedDates}
            />
          ) : (
            <div className="h-14" />
          )}
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span>{hydrated ? formatLongDate(selectedDate) : " "}</span>
                {hydrated && selectedKey === todayKey && (
                  <Badge variant="secondary">Today</Badge>
                )}
              </span>
              {dayEvents.length > 0 && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDuration(totalMs)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dayEvents.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No events scheduled.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {dayEvents.map((event) => {
                  const duration = event.endMs - event.startMs;
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => setDialogEvent(event)}
                        className="-mx-1 flex w-[calc(100%+0.5rem)] flex-col gap-1 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatTimeOfDay(event.startMs)} – {formatTimeOfDay(event.endMs)}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatDuration(duration)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {event.title ?? "(no title)"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {event.category?.color && (
                              <span
                                aria-hidden
                                className="size-2 rounded-full"
                                style={{ backgroundColor: event.category.color }}
                              />
                            )}
                            <Badge
                              variant={event.category ? "secondary" : "outline"}
                            >
                              {event.category?.name ?? "Uncategorized"}
                            </Badge>
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <SyncCalendarButton />
          </CardContent>
        </Card>
      </main>

      <EventCategoryDialog
        event={dialogEvent}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setDialogEvent(null);
        }}
      />
    </div>
  );
}
