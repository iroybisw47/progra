import { CheckIcon } from "lucide-react";

import { addDaysISO } from "@/lib/dates";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { cn } from "@/lib/utils";

// Compact, display-only habits-this-week grid (V2 profile). One row per habit:
// the habit name on the left, then a circle under each weekday (M–S, Monday
// first). A filled circle with a check = completed that day; future days are
// dimmed. Marking happens on the Habits tab — this is a read view.
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function HabitWeekGrid({
  habits,
  completions,
  weekStart,
  today,
}: {
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string; // Monday of this week, YYYY-MM-DD (user tz)
  today: string; // YYYY-MM-DD (user tz)
}) {
  if (habits.length === 0) {
    return <p className="text-caption text-sm">No habits to show.</p>;
  }

  const dayDates = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const done = new Set(completions.map((c) => `${c.habitId}|${c.completedOn}`));

  return (
    <div className="flex flex-col gap-1.5">
      {/* Day-letter header, aligned over the circle columns. */}
      <div className="flex items-center gap-2">
        <span className="flex-1" />
        <div className="flex gap-1">
          {LETTERS.map((l, i) => (
            <span
              key={i}
              className={cn(
                "w-6 text-center text-[10px] font-bold uppercase",
                dayDates[i] === today ? "text-brand" : "text-caption"
              )}
            >
              {l}
            </span>
          ))}
        </div>
      </div>

      {habits.map((h) => (
        <div key={h.id} className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {h.color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: h.color }}
              />
            )}
            <span className="truncate text-sm">{h.name}</span>
          </div>
          <div className="flex gap-1">
            {dayDates.map((d, i) => {
              const isDone = done.has(`${h.id}|${d}`);
              const isFuture = d > today;
              return (
                <span
                  key={i}
                  aria-label={`${h.name} ${LETTERS[i]}${isDone ? " done" : ""}`}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border",
                    isDone
                      ? "border-brand bg-brand text-primary-foreground"
                      : isFuture
                        ? "border-hairline opacity-40"
                        : "border-hairline"
                  )}
                >
                  {isDone && <CheckIcon className="size-3.5" strokeWidth={3} />}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
