import { CheckIcon } from "lucide-react";

import { addDaysISO } from "@/lib/dates";
import { entityColor } from "@/lib/colors";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { cn } from "@/lib/utils";

// Compact habits-this-week grid. One row per habit: a color square + the habit
// name, then a small square under each weekday (M–S, Monday first) filled in
// the habit's own color when it was completed. Future days are dimmed. Shared
// by Progress (Week) and You. With `onToggle` the squares are buttons, so a
// missed day this week can be checked off in place (useHabitToggle supplies
// both `done` and `onToggle`); without it, it's a read view.
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function HabitWeekGrid({
  habits,
  completions,
  weekStart,
  today,
  done: doneOverride,
  onToggle,
}: {
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string; // Monday of this week, YYYY-MM-DD (user tz)
  today: string; // YYYY-MM-DD (user tz)
  // Optimistic `habitId|date` set; falls back to `completions` when absent.
  done?: Set<string>;
  onToggle?: (habitId: string, date: string) => void;
}) {
  if (habits.length === 0) {
    return <p className="text-caption text-sm">No habits to show.</p>;
  }

  const dayDates = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const done =
    doneOverride ??
    new Set(completions.map((c) => `${c.habitId}|${c.completedOn}`));

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
              const label = `${h.name} ${LETTERS[i]}${isDone ? " done" : ""}`;
              const className = cn(
                "flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border-[1.5px] text-white",
                !isDone && "border-hairline",
                isFuture && "opacity-35",
                onToggle &&
                  "transition-[background-color,border-color,transform] duration-150",
                onToggle && !isFuture && "active:scale-90"
              );
              const style = isDone
                ? { backgroundColor: color, borderColor: color }
                : undefined;
              const check = isDone && (
                <CheckIcon className="size-3" strokeWidth={3.4} />
              );
              return onToggle ? (
                <button
                  key={i}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onToggle(h.id, d)}
                  aria-label={label}
                  aria-pressed={isDone}
                  className={className}
                  style={style}
                >
                  {check}
                </button>
              ) : (
                <span key={i} aria-label={label} className={className} style={style}>
                  {check}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
