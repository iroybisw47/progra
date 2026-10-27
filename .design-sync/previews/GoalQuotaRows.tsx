import { GoalQuotaRows } from "progra";

const H = 60 * 60 * 1000;

// THE goal row everywhere a goal appears: color square, title, "X.Xh / Yh",
// and a 5px bar in the goal's own color.
const goals = [
  { id: "g1", title: "Thesis", color: "#395AA0", quotaHours: 10, actualMs: 6.5 * H },
  { id: "g2", title: "Spanish", color: "#E07042", quotaHours: 3, actualMs: 2 * H },
  { id: "g3", title: "Gym", color: "#2E8B50", quotaHours: 4, actualMs: 4.5 * H },
  { id: "g4", title: "Read 20 pages a day", color: "#A084B3", quotaHours: 3, actualMs: 0 },
];

export function ThisWeek() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <GoalQuotaRows goals={goals} />
    </div>
  );
}

// On Progress each row links to clock in against that goal.
export function Linked() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <GoalQuotaRows goals={goals.slice(0, 2)} href="/clock?goal=" />
    </div>
  );
}
