"use client";

import { Badge } from "@/components/ui/badge";
import type { Goal } from "@/lib/db/goals";
import type { SessionPlan } from "@/lib/db/session-plans";

type PlanPickerProps = {
  goals: Goal[];
  plans: SessionPlan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PlanPicker({ goals, plans, selectedId, onSelect }: PlanPickerProps) {
  const plansByGoalId = new Map<string, SessionPlan[]>();
  for (const p of plans) {
    const list = plansByGoalId.get(p.goalId) ?? [];
    list.push(p);
    plansByGoalId.set(p.goalId, list);
  }
  const goalsWithPlans = goals.filter(
    (g) => (plansByGoalId.get(g.id) ?? []).length > 0
  );

  if (goalsWithPlans.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        Planned session{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </span>
      <div className="flex flex-col gap-3">
        {goalsWithPlans.map((goal) => {
          const goalPlans = plansByGoalId.get(goal.id) ?? [];
          return (
            <div key={goal.id} className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">
                {goal.title}
              </span>
              <div className="flex flex-wrap gap-2">
                {goalPlans.map((plan) => {
                  const selected = selectedId === plan.id;
                  return (
                    <Badge
                      key={plan.id}
                      variant={selected ? "default" : "outline"}
                      className="h-8 cursor-pointer px-3 text-sm"
                      render={
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onSelect(plan.id)}
                        />
                      }
                    >
                      {plan.title}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
