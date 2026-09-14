// Hand-rolled SVG — no chart dependency. Both charts are bars on a fixed
// viewBox that stretches to the container width, and color comes from theme
// tokens via Tailwind fill classes, so they follow light/dark with the app.

// Daily active users. The last bar is today, which isn't over yet, so it's
// drawn fainter rather than letting a partial day read as a drop.
export function DauChart({ series }: { series: { day: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.count));
  const W = 300;
  const H = 72;
  const gap = 2;
  const barW = (W - gap * (series.length - 1)) / series.length;

  return (
    <div className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[72px] w-full"
        role="img"
        aria-label={`Daily active users, last ${series.length} days, peak ${max}`}
      >
        {series.map((d, i) => {
          const h = d.count === 0 ? 0 : Math.max(2, (d.count / max) * H);
          const isToday = i === series.length - 1;
          return (
            <rect
              key={d.day}
              x={i * (barW + gap)}
              y={H - h}
              width={barW}
              height={h}
              rx={1}
              className={isToday ? "fill-brand/40" : "fill-brand"}
            >
              <title>{`${d.day}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="text-caption flex justify-between text-[10px] tabular-nums">
        <span>{series[0]?.day.slice(5)}</span>
        <span>peak {max}</span>
        <span>today</span>
      </div>
    </div>
  );
}

// One person's last N days. Bar height = tracked minutes (scaled to their own
// busiest day, so the shape reads even for light users); a dot under the bar =
// at least one habit ticked. Empty days keep a faint baseline tick so gaps
// read as gaps, not as missing data.
export function Sparkline({
  days,
}: {
  days: { day: string; trackedMin: number; habitTicks: number }[];
}) {
  const max = Math.max(1, ...days.map((d) => d.trackedMin));
  const W = 300;
  const BAR_H = 28;
  const H = BAR_H + 6;
  const gap = 2;
  const barW = (W - gap * (days.length - 1)) / days.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-[34px] w-full"
      role="img"
      aria-label={`Activity, last ${days.length} days`}
    >
      {days.map((d, i) => {
        const x = i * (barW + gap);
        const h = d.trackedMin === 0 ? 0 : Math.max(2, (d.trackedMin / max) * BAR_H);
        return (
          <g key={d.day}>
            <title>{`${d.day}: ${d.trackedMin}m tracked, ${d.habitTicks} habit${d.habitTicks === 1 ? "" : "s"}`}</title>
            {h === 0 ? (
              <rect x={x} y={BAR_H - 1} width={barW} height={1} className="fill-track" />
            ) : (
              <rect x={x} y={BAR_H - h} width={barW} height={h} rx={1} className="fill-brand" />
            )}
            {d.habitTicks > 0 && (
              <rect x={x} y={BAR_H + 3} width={barW} height={2} rx={1} className="fill-success" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
