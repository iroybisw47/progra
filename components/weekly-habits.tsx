"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CircleIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DAY_LABELS, addDaysISO, parseLocalDate, formatLongDate } from "@/lib/dates";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { cn } from "@/lib/utils";

import { toggleHabitCompletion } from "@/app/actions/habits";

type Props = {
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string; // YYYY-MM-DD, Monday of this week in user's tz
  today: string; // YYYY-MM-DD in user's tz
};

type ToggleAction = { habitId: string; date: string };

export function WeeklyHabits({ habits, completions, weekStart, today }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const activeIds = new Set(habits.map((h) => h.id));
  const baseFiltered = completions.filter((c) => activeIds.has(c.habitId));

  // Optimistic completions: flips a (habit, date) pair instantly; reconciled
  // when fresh props arrive after router.refresh.
  const [filtered, applyToggle] = useOptimistic(
    baseFiltered,
    (state: HabitCompletion[], action: ToggleAction): HabitCompletion[] => {
      const exists = state.some(
        (c) => c.habitId === action.habitId && c.completedOn === action.date
      );
      if (exists) {
        return state.filter(
          (c) =>
            !(c.habitId === action.habitId && c.completedOn === action.date)
        );
      }
      return [
        ...state,
        {
          id: `optimistic-${action.habitId}-${action.date}`,
          habitId: action.habitId,
          completedOn: action.date,
        },
      ];
    }
  );

  function handleToggle(habitId: string, date: string) {
    if (date > today) return; // can't fill future days
    startTransition(async () => {
      applyToggle({ habitId, date });
      const r = await toggleHabitCompletion(habitId, date);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  // Map: completed_on -> Set<habit_id>.
  const completionsByDate = new Map<string, Set<string>>();
  for (const c of filtered) {
    let s = completionsByDate.get(c.completedOn);
    if (!s) {
      s = new Set();
      completionsByDate.set(c.completedOn, s);
    }
    s.add(c.habitId);
  }

  const dayDates = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const countsByDay = dayDates.map((d) => completionsByDate.get(d)?.size ?? 0);
  const totalCompletions = countsByDay.reduce((a, b) => a + b, 0);
  const avgPerDay = totalCompletions / 7;

  // Top habits by completion count this week. Tie-break by createdAt ASC.
  const completionsByHabit = new Map<string, number>();
  for (const c of filtered) {
    completionsByHabit.set(c.habitId, (completionsByHabit.get(c.habitId) ?? 0) + 1);
  }
  const topHabits = habits
    .map((h) => ({ habit: h, count: completionsByHabit.get(h.id) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count || a.habit.createdAt - b.habit.createdAt
    )
    .slice(0, 3);

  const todayIndex = dayDates.indexOf(today);
  const inDayMode = selectedDayIndex !== null;
  const selectedDate = inDayMode ? dayDates[selectedDayIndex] : null;
  const selectedDateObj = selectedDate ? parseLocalDate(selectedDate) : null;
  const isTodaySelected = selectedDate === today;
  const dayLabel =
    selectedDateObj === null
      ? ""
      : isTodaySelected
        ? "Today"
        : formatLongDate(selectedDateObj);

  return (
    <Card>
      {inDayMode ? (
        <CardHeader>
          <CardTitle>{dayLabel}</CardTitle>
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedDayIndex(null)}
            >
              Week
            </Button>
          </CardAction>
        </CardHeader>
      ) : (
        <CardHeader>
          <CardTitle>Habits this week</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-5">
        {habits.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            No habits yet. Add some on the Habits tab.
          </p>
        ) : inDayMode ? (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-border">
              {habits.map((h) => {
                const done =
                  completionsByDate.get(selectedDate!)?.has(h.id) ?? false;
                const isFuture = selectedDate! > today;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      disabled={isFuture}
                      aria-pressed={done}
                      onClick={() => handleToggle(h.id, selectedDate!)}
                      className="-mx-2 flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {done ? (
                        <CheckIcon className="size-4 text-primary" />
                      ) : (
                        <CircleIcon className="size-4 text-muted-foreground" />
                      )}
                      {h.color && (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: h.color }}
                        />
                      )}
                      <span
                        className={
                          "flex-1 text-sm " +
                          (done ? "" : "text-muted-foreground")
                        }
                      >
                        {h.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selectedDate! > today ? (
              <p className="text-muted-foreground text-xs">
                Future day — nothing to fill in yet.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Tap a habit to mark it done for this day.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Average per day
              </span>
              <span className="font-mono text-2xl tabular-nums">
                {avgPerDay.toFixed(1)}
              </span>
            </div>

            {topHabits.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Top habits
                </span>
                <ol className="flex flex-col gap-1.5">
                  {topHabits.map((t, i) => (
                    <li
                      key={t.habit.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-4 font-mono text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      {t.habit.color && (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: t.habit.color }}
                        />
                      )}
                      <span className="flex-1">{t.habit.name}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {t.count} {t.count === 1 ? "day" : "days"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {topHabits.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Nothing done this week yet.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label, i) => {
            const count = countsByDay[i];
            const isToday = i === todayIndex;
            const isSelected = selectedDayIndex === i;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  setSelectedDayIndex((cur) => (cur === i ? null : i))
                }
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md py-1.5 text-xs transition-colors hover:bg-muted/60",
                  isSelected
                    ? "bg-primary/15 text-foreground ring-1 ring-primary"
                    : isToday
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : ""
                )}
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono tabular-nums">
                  {count > 0 ? count : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
