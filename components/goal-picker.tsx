"use client";

import { PickerPill } from "@/components/category-picker";
import { goalColor } from "@/lib/colors";
import type { Goal } from "@/lib/db/goals";

type GoalPickerProps = {
  goals: Goal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint?: string;
};

// Single-select goal pills, the same shape as CategoryPicker. Selecting a goal
// is mutually exclusive with picking a category (enforced by the caller). Each
// goal shows its own derived color, matching its quota bar on Progress.
export function GoalPicker({
  goals,
  selectedId,
  onSelect,
  emptyHint = "Add a goal on the Goals tab first.",
}: GoalPickerProps) {
  if (goals.length === 0) {
    return <p className="text-caption text-sm">{emptyHint}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {goals.map((goal) => (
        <PickerPill
          key={goal.id}
          label={goal.title}
          color={goalColor(goal.id)}
          selected={selectedId === goal.id}
          onSelect={() => onSelect(goal.id)}
        />
      ))}
    </div>
  );
}
