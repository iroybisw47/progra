import type { ReviewStat } from "@/lib/weekly-review";
import { cn } from "@/lib/utils";

// A posted weekly review's numbers — hours tracked, % towards goals, % of
// habits done — side by side, in the review's serif. The same three on the
// Share slide's preview, the feed card and /review/[id], so what's posted is
// exactly what was previewed. Which stats appear is reviewStats()'s call.
export function ReviewStats({
  stats,
  size = "md",
  className,
}: {
  stats: ReviewStat[];
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("grid", size === "lg" ? "gap-5" : "gap-3", className)} style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
      {stats.map((s) => (
        <div key={s.key} className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              "text-ink font-serif leading-none font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums",
              size === "lg" ? "text-[36px]" : "text-[30px]"
            )}
          >
            {s.value}
            <span
              className={cn(
                "text-secondary-ink tracking-[-0.01em]",
                size === "lg" ? "ml-0.5 text-[16px]" : "ml-0.5 text-[14px]"
              )}
            >
              {s.unit}
            </span>
          </span>
          <span className="text-caption truncate text-[11.5px] leading-[1.3]">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
