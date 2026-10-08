// The eight categories a goal can be labelled with (Phase 2 of the internal
// analytics). Pure and shared: the classifier's output schema, the
// `goals_category_label_check` CHECK in phase1.sql and the dashboard's
// "Goals by category" all read this one list — change it here and in the SQL
// together, or the write is rejected.
export const GOAL_CATEGORIES = [
  "fitness",
  "study_school",
  "work_career",
  "reading",
  "creative",
  "language",
  "wellbeing",
  "not_time_based",
] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  fitness: "Fitness",
  study_school: "Study & school",
  work_career: "Work & career",
  reading: "Reading",
  creative: "Creative",
  language: "Language",
  wellbeing: "Wellbeing",
  not_time_based: "Not time-based",
};

export function isGoalCategory(v: unknown): v is GoalCategory {
  return typeof v === "string" && (GOAL_CATEGORIES as readonly string[]).includes(v);
}
