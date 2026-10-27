import { HabitWeekGrid } from "progra";

const habit = (id: string, name: string, color: string) => ({
  id, name, color, createdAt: 0, archivedAt: null, isPrivate: false,
});
const habits = [
  habit("h1", "Meditate", "#77B7C6"),
  habit("h2", "No phone before 10", "#6F4E93"),
  habit("h3", "Run", "#2E8B50"),
  habit("h4", "Journal", "#D6A728"),
];
const done = (habitId: string, days: number[]) =>
  days.map((d) => ({ id: `${habitId}-${d}`, habitId, completedOn: `2026-10-0${5 + d}` }));

// Week of Mon Oct 5; today is Thursday (its letter turns navy, later days dim).
export function ThisWeek() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <HabitWeekGrid
        habits={habits}
        completions={[...done("h1", [0, 1, 2, 3]), ...done("h2", [0, 2]), ...done("h3", [1, 3]), ...done("h4", [0, 1, 2])]}
        weekStart="2026-10-05"
        today="2026-10-08"
      />
    </div>
  );
}

export function Empty() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <HabitWeekGrid habits={[]} completions={[]} weekStart="2026-10-05" today="2026-10-08" />
    </div>
  );
}
