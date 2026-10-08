import type { ReactNode } from "react";

import { formatRelativeTime } from "@/lib/dates";

// Small server-safe pieces every tab uses. Stat tiles follow the dataviz
// contract: label, a proportional-figure value, an optional signed delta
// against a NAMED period. Nothing here is interactive.

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="section-label">{title}</span>
        {hint && <p className="text-caption text-[11px] leading-snug">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function Tile({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: string;
  // Signed change vs the prior 7 days; null when there is no prior.
  delta?: number | null;
  sub?: string;
}) {
  return (
    <div className="border-hairline flex flex-col gap-0.5 rounded-lg border px-3 py-2.5">
      <span className="text-caption text-[11px] leading-tight">{label}</span>
      <span className="text-[22px] leading-tight font-semibold">{value}</span>
      {delta !== undefined && delta !== null && (
        <span className="text-caption text-[11px] tabular-nums">
          {delta > 0 ? "+" : ""}
          {delta} vs prior 7d
        </span>
      )}
      {sub && <span className="text-caption text-[11px]">{sub}</span>}
    </div>
  );
}

export function Collecting({ children }: { children: ReactNode }) {
  return (
    <div className="border-hairline text-caption rounded-lg border border-dashed px-3 py-3 text-xs">
      <span className="font-semibold">Collecting data.</span> {children}
    </div>
  );
}

export function NotInstalled({ what }: { what: string }) {
  return (
    <p className="text-caption text-sm">
      {what} unavailable — the phase-4 analytics RPCs aren&apos;t installed yet
      (run <code>.claude/plans/analytics/phase4.sql</code>).
    </p>
  );
}

export function Tag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "ghost" | "state" }) {
  return (
    <span
      className={
        "rounded-full border px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] uppercase " +
        (tone === "ghost"
          ? "border-transparent bg-[color-mix(in_oklab,#6F4E93_14%,transparent)] text-[#533672]"
          : tone === "state"
            ? "border-transparent bg-track text-ink"
            : "border-hairline text-caption")
      }
    >
      {children}
    </span>
  );
}

export function fmtHours(h: number): string {
  return `${h.toFixed(1)}h`;
}

export function fmtPct(n: number | null): string {
  return n === null ? "—" : `${n}%`;
}

export function fmtAgo(iso: string | null, nowMs: number | null): string {
  if (iso === null) return "never";
  if (nowMs === null) return iso.slice(0, 10);
  return formatRelativeTime(Date.parse(iso), nowMs);
}

export const STATE_LABEL: Record<string, string> = {
  active: "Active",
  lapsed: "Lapsed",
  never_logged: "Never logged",
  not_onboarded: "Not onboarded",
};

// A compact two-column key/value table used for the small comparison blocks.
export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-caption">{k}</dt>
          <dd className="text-right font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
