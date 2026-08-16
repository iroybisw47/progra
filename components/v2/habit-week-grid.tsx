import { CheckIcon } from "lucide-react";

import { addDaysISO } from "@/lib/dates";
import { entityColor } from "@/lib/colors";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { cn } from "@/lib/utils";

// Compact, display-only habits-this-week grid. One row per habit: a color
// square + the habit name, then a small square under each weekday (M–S, Monday
// first) filled in the habit's own color when it was completed. Future days are
// dimmed. Marking happens on the Today pills / the manage sheet — this is a
// read view, shared by Progress (Week) and You.
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
    <div className="flex flex-col">
      {/* Day-letter header, aligned over the square columns. */}
      <div className="flex items-center gap-1 pb-[7px]">
        <span className="flex-1" />
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className={cn(
              "w-[26px] text-center text-[9px] font-semibold tracking-[0.06em]",
              dayDates[i] === today ? "text-brand" : "text-disabled"
            )}
          >
            {l}
          </span>
        ))}
      </div>

      {habits.map((h) => {
        const color = entityColor(h.color);
        return (
          <div
            key={h.id}
            className="border-divider flex items-center gap-1 border-t py-1.5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-1">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
              <span className="text-body truncate text-[13px]">{h.name}</span>
            </div>
            {dayDates.map((d, i) => {
              const isDone = done.has(`${h.id}|${d}`);
              const isFuture = d > today;
              return (
                <span
                  key={i}
                  aria-label={`${h.name} ${LETTERS[i]}${isDone ? " done" : ""}`}
                  className={cn(
                    "flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border-[1.5px] text-white",
                    !isDone && "border-hairline",
                    isFuture && "opacity-35"
                  )}
                  style={
                    isDone
                      ? { backgroundColor: color, borderColor: color }
                      : undefined
                  }
                >
                  {isDone && <CheckIcon className="size-3" strokeWidth={3.4} />}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
