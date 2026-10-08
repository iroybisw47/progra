"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// The dashboard's charts, on shadcn's recharts wrapper. One file so the mark
// specs are in one place: bars at most 16px thick with a 4px rounded data-end,
// 2px lines, a solid hairline grid, text in text tokens, a legend whenever
// there are two or more series, and a tooltip on every mark.
//
// Colour: the app's own palette (lib/palette.ts), validated as a four-slot
// categorical set with the dataviz checker — Green, Orange, Dark purple, Dark
// blue — plus the theme's neutral for "nothing yet". Light blue and Light green
// failed the chroma / contrast gates and are not used.

export const SLOT = {
  green: "#2E8B50",
  orange: "#E07042",
  purple: "#6F4E93",
  blue: "#395AA0",
  neutral: "var(--track)",
} as const;

const grid = { stroke: "var(--hairline)", strokeDasharray: undefined };
const tick = { fontSize: 11, fill: "var(--faint)" };

// --- the state bar -----------------------------------------------------------

export function StateBar({
  active,
  lapsed,
  neverLogged,
  notOnboarded,
}: {
  active: number;
  lapsed: number;
  neverLogged: number;
  notOnboarded: number;
}) {
  // Stack order = adjacency, and the validator passed green → blue → orange
  // (→ purple); the neutral closes the bar for "nothing yet".
  const config = {
    active: { label: "Active", color: SLOT.green },
    lapsed: { label: "Lapsed", color: SLOT.blue },
    never_logged: { label: "Never logged", color: SLOT.orange },
    not_onboarded: { label: "Not onboarded", color: SLOT.neutral },
  } satisfies ChartConfig;
  const data = [{ name: "users", active, lapsed, never_logged: neverLogged, not_onboarded: notOnboarded }];
  return (
    <ChartContainer config={config} className="aspect-auto h-[88px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 4, bottom: 0 }} barCategoryGap={0}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" hide />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <ChartLegend content={<ChartLegendContent />} />
        {(["active", "lapsed", "never_logged", "not_onboarded"] as const).map((k, i, all) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="s"
            fill={`var(--color-${k})`}
            barSize={16}
            stroke="var(--background)"
            strokeWidth={2}
            radius={i === all.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

// --- horizontal bars, one series ---------------------------------------------
// Used for the funnel, drop-off by screen, friend buckets, ghost behaviour,
// permission. Ordinal data → one hue; the value sits at the bar's tip.

export function HBars({
  rows,
  color = SLOT.blue,
  label = "Users",
  height,
  suffix = "",
}: {
  rows: { label: string; value: number; note?: string }[];
  color?: string;
  label?: string;
  height?: number;
  suffix?: string;
}) {
  const config = { value: { label, color } } satisfies ChartConfig;
  const h = height ?? Math.max(72, rows.length * 30 + 8);
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: h }}>
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 36, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} {...grid} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={118} tickLine={false} axisLine={false} tick={tick} interval={0} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v, _n, item) => {
                const row = item.payload as { note?: string } | undefined;
                return (
                  <span className="tabular-nums">
                    {String(v)}
                    {suffix}
                    {row?.note ? <span className="text-caption"> · {row.note}</span> : null}
                  </span>
                );
              }}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" barSize={14} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="value" position="right" fontSize={11} fill="var(--ink)" formatter={(label) => `${label ?? ""}${suffix}`} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// --- two series over time ------------------------------------------------------

export function PerUserSeries({
  rows,
}: {
  rows: { day: string; clock: number; habit: number }[];
}) {
  const config = {
    clock: { label: "Clock-ins / active user", color: SLOT.blue },
    habit: { label: "Habit checks / active user", color: SLOT.green },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[180px] w-full">
      <LineChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} {...grid} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={tick} tickFormatter={(d: string) => d.slice(5)} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={28} allowDecimals />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line type="monotone" dataKey="clock" stroke="var(--color-clock)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }} />
        <Line type="monotone" dataKey="habit" stroke="var(--color-habit)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }} />
      </LineChart>
    </ChartContainer>
  );
}

// --- grouped vertical bars: a rate per bucket, two series ------------------------
// Lift by hour, fatigue, ghost-vs-active response.

export function RateBars({
  rows,
  a,
  b,
  xKey = "label",
}: {
  rows: Record<string, string | number | null>[];
  a: { key: string; label: string; color?: string };
  b?: { key: string; label: string; color?: string };
  xKey?: string;
}) {
  const config = {
    [a.key]: { label: a.label, color: a.color ?? SLOT.blue },
    ...(b ? { [b.key]: { label: b.label, color: b.color ?? SLOT.orange } } : {}),
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[160px] w-full">
      <BarChart data={rows} margin={{ left: 0, right: 4, top: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} {...grid} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={tick} interval={0} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={30} unit="%" />
        <ChartTooltip content={<ChartTooltipContent />} />
        {b && <ChartLegend content={<ChartLegendContent />} />}
        <Bar dataKey={a.key} fill={`var(--color-${a.key})`} barSize={12} radius={[4, 4, 0, 0]} />
        {b && <Bar dataKey={b.key} fill={`var(--color-${b.key})`} barSize={12} radius={[4, 4, 0, 0]} />}
      </BarChart>
    </ChartContainer>
  );
}
