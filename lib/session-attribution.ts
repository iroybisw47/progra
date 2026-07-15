import type { Category, Session } from "@/lib/storage";
import type { Goal } from "@/lib/db/goals";

// The label shown on a session's attribution chip. A goal-tracked session reads
// "Goal · {title}" (isGoal drives the "Goal · " prefix in the UI); a category
// session reads the category name; anything else is "Uncategorized".
export type Attribution = { text: string; isGoal: boolean };

export function resolveAttribution(
  session: Pick<Session, "categoryId" | "goalId">,
  categories: Category[],
  goals: Goal[]
): Attribution {
  if (session.goalId) {
    const g = goals.find((x) => x.id === session.goalId);
    return { text: g ? g.title : "Goal", isGoal: true };
  }
  if (session.categoryId) {
    const c = categories.find((x) => x.id === session.categoryId);
    return { text: c ? c.name : "Uncategorized", isGoal: false };
  }
  return { text: "Uncategorized", isGoal: false };
}
