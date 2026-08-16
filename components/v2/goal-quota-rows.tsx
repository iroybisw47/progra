import Link from "next/link";

import { goalColor } from "@/lib/colors";

const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

export type QuotaGoal = {
  id: string;
  title: string;
  quotaHours: number;
  actualMs: number;
};

// THE goal-quota row: color square, title, "X.Xh / Yh" tabular, and a 5px bar
// in the goal's own color. Progress, You, the leaderboard expansion and a
// friend's profile all render goals through this, so a goal looks the same
// wherever it turns up.
export function GoalQuotaRows({
  goals,
  href,
}: {
  goals: QuotaGoal[];
  // When set, each row links to `${href}${goal.id}` (Progress clocks in
  // against the goal); omitted on read-only surfaces like a friend's profile.
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      {goals.map((g) => {
        const color = goalColor(g.id);
        const quotaMs = g.quotaHours * HOUR_MS;
        const pct =
          quotaMs > 0 ? Math.min(100, (g.actualMs / quotaMs) * 100) : 0;

        const row = (
          <>
            <div className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="size-[9px] shrink-0 translate-y-px rounded-[2px]"
                style={{ backgroundColor: color }}
              />
              <span className="text-body min-w-0 flex-1 truncate text-[13px] font-semibold">
                {g.title}
              </span>
              <span className="text-ink shrink-0 text-[13px] font-semibold tabular-nums">
                {fmtH(g.actualMs)}
              </span>
              <span className="text-caption shrink-0 text-xs tabular-nums">
                / {g.quotaHours.toFixed(0)}h
              </span>
            </div>
            <div className="bg-track h-[5px] w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: g.actualMs > 0 ? `${Math.max(2, pct)}%` : "0%",
                  backgroundColor: color,
                }}
              />
            </div>
          </>
        );

        return href ? (
          <Link
            key={g.id}
            href={`${href}${g.id}`}
            aria-label={`Clock in to ${g.title}`}
            className="flex flex-col gap-1 transition-transform active:scale-[.99]"
          >
            {row}
          </Link>
        ) : (
          <div key={g.id} className="flex flex-col gap-1">
            {row}
          </div>
        );
      })}
    </div>
  );
}
