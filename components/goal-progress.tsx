const HOUR_MS = 60 * 60 * 1000;

function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

type GoalProgressBarProps = {
  // Optional left-aligned label. When omitted, the hours label takes the row.
  title?: string;
  quotaHours: number;
  actualMs: number;
};

export function GoalProgressBar({
  title,
  quotaHours,
  actualMs,
}: GoalProgressBarProps) {
  const quotaMs = quotaHours * HOUR_MS;
  const hasQuota = quotaMs > 0;
  // Cap the bar at 100% — over-quota state shows in the label ("7 / 6h").
  const pct = hasQuota ? Math.min(100, (actualMs / quotaMs) * 100) : 0;
  const hoursLabel = hasQuota
    ? `${formatHours(actualMs)} / ${quotaHours.toFixed(1)}h`
    : formatHours(actualMs);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        {title ? <span className="truncate">{title}</span> : <span />}
        <span className="font-mono tabular-nums text-muted-foreground shrink-0">
          {hoursLabel}
        </span>
      </div>
      {hasQuota && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary/60"
            style={{
              width: actualMs > 0 ? `${Math.max(2, pct)}%` : "0%",
            }}
          />
        </div>
      )}
    </div>
  );
}
