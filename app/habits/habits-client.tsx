"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { WeeklyHabits } from "@/components/weekly-habits";

import {
  archiveHabit,
  createHabit,
  toggleHabitCompletion,
} from "@/app/actions/habits";
import type { Habit, HabitCompletion } from "@/lib/db/habits";

type Props = {
  habits: Habit[];
  completions: HabitCompletion[];
  todayLocal: string;
  weekStart: string;
};

type TodayItem = { habit: Habit; completedToday: boolean };

export function HabitsClient({
  habits,
  completions,
  todayLocal,
  weekStart,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");

  // Today's status is derived from the week's completions, not a separate fetch.
  const todayCompletedSet = new Set(
    completions
      .filter((c) => c.completedOn === todayLocal)
      .map((c) => c.habitId)
  );
  const items: TodayItem[] = habits.map((habit) => ({
    habit,
    completedToday: todayCompletedSet.has(habit.id),
  }));

  // Optimistic toggle: the UI flips instantly. The optimistic state is
  // discarded when the transition ends and new props arrive from refresh.
  const [optimisticItems, toggleOptimistic] = useOptimistic(
    items,
    (state: TodayItem[], habitId: string): TodayItem[] =>
      state.map((it) =>
        it.habit.id === habitId
          ? { ...it, completedToday: !it.completedToday }
          : it
      )
  );

  function handleToggle(habitId: string) {
    startTransition(async () => {
      toggleOptimistic(habitId);
      const r = await toggleHabitCompletion(habitId, todayLocal);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const r = await createHabit(trimmed);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setName("");
      toast.success(`Added ${trimmed}`);
      router.refresh();
    });
  }

  function handleArchive(habitId: string, habitName: string) {
    startTransition(async () => {
      const r = await archiveHabit(habitId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Archived ${habitName}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Habits</h1>
          <p className="text-muted-foreground text-sm">Today&apos;s check-list.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {optimisticItems.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No habits yet. Add one below.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {optimisticItems.map(({ habit, completedToday }) => (
                  <li
                    key={habit.id}
                    className="flex min-h-11 items-center gap-3 py-1"
                  >
                    <Checkbox
                      checked={completedToday}
                      onCheckedChange={() => handleToggle(habit.id)}
                      aria-label={
                        completedToday
                          ? `Mark ${habit.name} not done`
                          : `Mark ${habit.name} done`
                      }
                    />
                    {habit.color && (
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: habit.color }}
                      />
                    )}
                    <span
                      className={
                        "flex-1 text-sm " +
                        (completedToday
                          ? "text-muted-foreground line-through"
                          : "")
                      }
                    >
                      {habit.name}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Archive ${habit.name}`}
                      onClick={() => handleArchive(habit.id, habit.name)}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <WeeklyHabits
          habits={habits}
          completions={completions}
          weekStart={weekStart}
          today={todayLocal}
        />

        <Card>
          <CardHeader>
            <CardTitle>Add habit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                className="h-10"
                placeholder="Drink water, read 30m, …"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <Button
                className="h-10"
                variant="secondary"
                onClick={handleAdd}
                disabled={!name.trim()}
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
