// A ring chart driven by stroke-dasharray. Works as a thin donut (This week) or
// a thick donut-pie (History) via the `stroke` prop. Colors are CSS values
// (hex or `var(--token)`). Center label/sub overlay optional. Pure/presentational.
type Segment = { color: string; value: number };

export function Donut({
  segments,
  size = 150,
  stroke = 14,
  label,
  sub,
}: {
  segments: Segment[];
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth={stroke}
        />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return el;
          })}
      </svg>
      {(label || sub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && (
            <span className="font-mono text-lg font-bold tabular-nums">
              {label}
            </span>
          )}
          {sub && (
            <span className="text-caption text-[10px] font-bold uppercase tracking-wide">
              {sub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
