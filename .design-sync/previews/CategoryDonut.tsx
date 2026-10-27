import { CategoryDonut } from "progra";

const H = 60 * 60 * 1000;

const segs = [
  { id: "goal:thesis", name: "Thesis", color: "#395AA0", ms: 7.5 * H },
  { id: "goal:gym", name: "Gym", color: "#2E8B50", ms: 4 * H },
  { id: "cat-cse", name: "CSE 332", color: "#77B7C6", ms: 3.25 * H },
  { id: "goal:spanish", name: "Spanish", color: "#E07042", ms: 2.5 * H },
  { id: null, name: "Uncategorized", color: "#c3c8ce", ms: 0.75 * H },
];
const total = segs.reduce((s, x) => s + x.ms, 0);

// Centered donut with the period total, then one row per category: square
// dot, name, "X.Xh · N%" in caption, and a bar in the category's color.
export function Week() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <CategoryDonut segs={segs} totalMs={total} />
    </div>
  );
}

// History passes items, so rows that have them get a disclosure chevron.
export function Expandable() {
  const t0 = Date.UTC(2026, 9, 6, 16);
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <CategoryDonut
        segs={segs.slice(0, 3)}
        totalMs={segs.slice(0, 3).reduce((s, x) => s + x.ms, 0)}
        items={{
          "goal:thesis": [
            { kind: "session", id: "s1", title: "Lit review", source: "session", startMs: t0, ms: 2 * H },
            { kind: "session", id: "s2", title: "Methods draft", source: "session", startMs: t0 + 86400000, ms: 3.5 * H },
          ],
        }}
      />
    </div>
  );
}
