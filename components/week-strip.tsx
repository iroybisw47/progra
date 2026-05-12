"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DAY_LABELS,
  addDays,
  formatLocalDate,
  startOfWeek,
} from "@/lib/dates";

type WeekStripProps = {
  selectedDate: Date;
  today: Date;
  onSelect: (d: Date) => void;
  markedDates: Set<string>;
};

export function WeekStrip({ selectedDate, today, onSelect, markedDates }: WeekStripProps) {
  const [weekAnchor, setWeekAnchor] = useState<Date>(selectedDate);
  const weekStart = startOfWeek(weekAnchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const selectedKey = formatLocalDate(selectedDate);
  const todayKey = formatLocalDate(today);

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Previous week"
        onClick={() => setWeekAnchor((a) => addDays(a, -7))}
      >
        <ChevronLeftIcon />
      </Button>
      <ul className="flex flex-1 gap-1">
        {days.map((d) => {
          const key = formatLocalDate(d);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const marked = markedDates.has(key);
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => {
                  setWeekAnchor(d);
                  onSelect(d);
                }}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "ring-1 ring-primary/40"
                      : "hover:bg-muted"
                )}
              >
                <span className={cn(isSelected ? "" : "text-muted-foreground")}>
                  {DAY_LABELS[(d.getDay() + 6) % 7]}
                </span>
                <span className="font-mono text-base tabular-nums">{d.getDate()}</span>
                <span
                  className={cn(
                    "size-1 rounded-full",
                    marked
                      ? isSelected
                        ? "bg-primary-foreground"
                        : "bg-primary/70"
                      : "bg-transparent"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Next week"
        onClick={() => setWeekAnchor((a) => addDays(a, 7))}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
