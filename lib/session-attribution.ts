import {
  entityColor,
  entityInk,
  entityOnDark,
  goalColorOf,
} from "@/lib/colors";
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

// The session's own colour, as concrete hexes — its goal's or its category's,
// resolved by the SAME rules the on-screen surfaces use (goalColorOf derives a
// stable hue from the id for goals predating the colour column; entityColor
// normalises the fill; entityInk darkens it for use as text).
//
// THREE, because they are not interchangeable. `fill` is for a marker or a
// swatch on white; `ink` is for a colour used as TEXT on white, which several
// palette entries (light green #7CBE6D, gold #D6A728, light blue #77B7C6) fail
// as; `onDark` is for a navy ground, where the fills go invisible (maroon
// 1.91:1) and the inks are worse still, being darker. lib/colors.ts keeps
// entityInk and entityOnDark for exactly this.
//
// Null when there is nothing to colour (an uncategorised session), so a caller
// picks its own neutral rather than being handed one.
export function resolveAttributionColor(
  session: Pick<Session, "categoryId" | "goalId">,
  categories: Category[],
  goals: Goal[]
): { fill: string; ink: string; onDark: string } | null {
  if (session.goalId) {
    const g = goals.find((x) => x.id === session.goalId);
    // goalColorOf takes the id alone when the goal isn't in hand — a goal
    // archived mid-session still colours consistently.
    const fill = goalColorOf(g ?? session.goalId);
    return { fill, ink: entityInk(fill), onDark: entityOnDark(fill) };
  }
  if (session.categoryId) {
    const c = categories.find((x) => x.id === session.categoryId);
    if (!c) return null;
    return {
      fill: entityColor(c.color),
      ink: entityInk(c.color),
      onDark: entityOnDark(c.color),
    };
  }
  return null;
}
