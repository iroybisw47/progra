"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { SectionHeader } from "@/components/v2/section-header";
import { addDaysISO } from "@/lib/dates";
import type { Habit, HabitCompletion } from "@/lib/db/habits";
import { useHabitToggle } from "@/lib/use-habit-toggle";

// Lazy for the same reason as on Progress: the editor is the biggest thing in
// the section and nobody pays for it until they tap the header.
const ManageHabits = dynamic(
  () => import("@/components/v2/manage-habits").then((m) => m.ManageHabits),
  { ssr: false }
);

// The You tab's "Habits" section: this week's grid — tap a square to check off
// a missed day in place — plus the header tap that opens the full editor: add,
// rename, recolor, delete, and page back up to HABIT_HISTORY_WEEKS weeks to
// backfill older days, exactly as on Progress.
export function HabitsSection({
  habits,
  completions,
  weekStart,
  today,
  minWeekStart,
}: {
  habits: Habit[];
  // The full history window the editor pages through. HabitWeekGrid ignores
  // dates outside the current week, so the wider set is harmless to it.
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  minWeekStart: string;
}) {
  const [open, setOpen] = useState(false);
  const { doneSet, toggle } = useHabitToggle(completions, today);
  // Counted off the optimistic set so the header moves with a tap. `completions`
  // spans the editor's whole window, so keep this week's keys only.
  const weekEnd = addDaysISO(weekStart, 6);
  const doneThisWeek = [...doneSet].filter((k) => {
    const date = k.slice(k.indexOf("|") + 1);
    return date >= weekStart && date <= weekEnd;
  }).length;

  return (
    <section className="flex flex-col">
      <SectionHeader
        label="Habits"
        meta={`${doneThisWeek} of ${habits.length * 7}`}
        onClick={() => setOpen(true)}
        ariaLabel="Manage habits"
        className="px-5 pt-3.5 pb-2"
      />
      <div className="px-5">
        <HabitWeekGrid
          habits={habits}
          completions={completions}
          weekStart={weekStart}
          today={today}
          done={doneSet}
          onToggle={toggle}
        />
      </div>

      <ManageHabits
        open={open}
        onOpenChange={setOpen}
        habits={habits}
        completions={completions}
        weekStart={weekStart}
        today={today}
        minWeekStart={minWeekStart}
      />
    </section>
  );
}
