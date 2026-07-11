import { WeekBreakdown } from "progra";

const H = 60 * 60 * 1000;

// Mirrors the home "Time this week" card: goal rows first (starred), then
// category rows, bars scaled against the largest row across both sections.
const goalRows = [
  { id: "goal:thesis", name: "Goal: Thesis", color: "var(--primary)", isGoal: true, ms: 7.5 * H },
  { id: "goal:spanish", name: "Goal: Spanish", color: "var(--primary)", isGoal: true, ms: 2.5 * H },
];

const categoryRows = [
  { id: "cat-deep-work", name: "Deep work", color: "#4f9b8c", isGoal: false, ms: 8.2 * H },
  { id: "cat-uni", name: "Uni", color: "#5f87c0", isGoal: false, ms: 5.5 * H },
  { id: "cat-gym", name: "Gym", color: "#c96f5e", isGoal: false, ms: 3.0 * H },
  { id: "cat-reading", name: "Reading", color: "#c7a23a", isGoal: false, ms: 2.1 * H },
  { id: null, name: "Uncategorized", color: null, isGoal: false, ms: 1.2 * H },
];

export function GoalsAndCategories() {
  return (
    <div className="w-full max-w-sm">
      <WeekBreakdown rows={[...goalRows, ...categoryRows]} />
    </div>
  );
}

export function CategoriesOnly() {
  return (
    <div className="w-full max-w-sm">
      <WeekBreakdown rows={categoryRows} />
    </div>
  );
}

export function GoalsOnly() {
  return (
    <div className="w-full max-w-sm">
      <WeekBreakdown rows={goalRows} />
    </div>
  );
}
