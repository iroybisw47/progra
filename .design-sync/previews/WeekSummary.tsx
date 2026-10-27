import { WeekSummary } from "progra";

const H = 60 * 60 * 1000;

// The app hands WeekSummary its goal rows with their own colors attached
// (GoalQuotaRows reads `color`); built as a variable so the extra field
// passes through the narrower WeekSummaryGoal type, exactly as in the app.
const goals = [
  { id: "g1", title: "Thesis", color: "#395AA0", quotaHours: 10, actualMs: 6.5 * H, status: "close" as const },
  { id: "g2", title: "Spanish", color: "#E07042", quotaHours: 3, actualMs: 2 * H, status: "close" as const },
  { id: "g3", title: "Gym", color: "#2E8B50", quotaHours: 4, actualMs: 4.5 * H, status: "hit" as const },
];

// The full weekly presentation shared by Progress → Week and History:
// eyebrow + counts, category donut, then goal quotas.
export function ProgressWeek() {
  const segs = [
    { id: "goal:g1", name: "Thesis", color: "#395AA0", ms: 6.5 * H },
    { id: "goal:g3", name: "Gym", color: "#2E8B50", ms: 4.5 * H },
    { id: "cat-cse", name: "CSE 332", color: "#77B7C6", ms: 3 * H },
    { id: "goal:g2", name: "Spanish", color: "#E07042", ms: 2 * H },
  ];
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <WeekSummary
        totalMs={segs.reduce((s, x) => s + x.ms, 0)}
        segs={segs}
        rangeLabel="Oct 5 – 11"
        tracked={14}
        imported={3}
        goalsHeaderExtra={
          <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">Manage</span>
        }
        goals={goals}
      />
    </div>
  );
}
