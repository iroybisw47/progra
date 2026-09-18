"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { SectionHeader } from "@/components/v2/section-header";
import type { Habit, HabitCompletion } from "@/lib/db/habits";

// Lazy for the same reason as on Progress: the editor is the biggest thing in
// the section and nobody pays for it until they tap the header.
const ManageHabits = dynamic(
  () => import("@/components/v2/manage-habits").then((m) => m.ManageHabits),
  { ssr: false }
);

// The You tab's "Habits" section: this week's grid, plus the header tap that
// opens the full editor — add, rename, recolor, delete, and page back up to
// HABIT_HISTORY_WEEKS weeks to backfill a missed day, exactly as on Progress.
export function HabitsSection({
  habits,
  completions,
  weekStart,
  today,
  minWeekStart,
  doneThisWeek,
}: {
  habits: Habit[];
  // The full history window the editor pages through. HabitWeekGrid ignores
  // dates outside the current week, so the wider set is harmless to it.
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
  minWeekStart: string;
  // Counted server-side against this week alone — `completions` spans more.
  doneThisWeek: number;
}) {
  const [open, setOpen] = useState(false);

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
