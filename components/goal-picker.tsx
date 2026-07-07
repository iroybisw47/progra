"use client";

import { Badge } from "@/components/ui/badge";
import type { Goal } from "@/lib/db/goals";

type GoalPickerProps = {
  goals: Goal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint?: string;
};

// Single-select goal chips, mirroring CategoryPicker. Selecting a goal is
// mutually exclusive with picking a category (enforced by the caller). All
// goal chips share the one accent (the default badge), not per-goal colors.
export function GoalPicker({
  goals,
  selectedId,
  onSelect,
  emptyHint = "Add a goal on the Goals tab first.",
}: GoalPickerProps) {
  if (goals.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyHint}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {goals.map((goal) => (
        <Badge
          key={goal.id}
          variant={selectedId === goal.id ? "default" : "outline"}
          className="h-8 cursor-pointer px-3 text-sm"
          render={
            <button
              type="button"
              aria-pressed={selectedId === goal.id}
              onClick={() => onSelect(goal.id)}
            />
          }
        >
          {goal.title}
        </Badge>
      ))}
    </div>
  );
}
