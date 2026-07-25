"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Donut } from "@/components/v2/donut";
import { formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { CategoryItem } from "@/lib/aggregate";

const HOUR_MS = 60 * 60 * 1000;
const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

// Short provenance tag next to each item in an expanded category.
const SOURCE_LABEL: Record<string, string> = {
  session: "clock",
  goal: "goal",
  rule: "rule",
  manual: "manual",
  ai: "AI",
  uncategorized: "uncat",
};

function itemDate(startMs: number): string {
  return new Date(startMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export type CatSeg = {
  // Category id (or "goal:<id>"); null/absent = Uncategorized. Used to look up
  // this row's items in the optional `items` map.
  id?: string | null;
  name: string;
  color: string;
  ms: number;
};

// The shared category-breakdown presentation: a centered donut with the period
// total in the middle, then each category underneath as a row with a colored
// bar sized to its share of the total (hours + percent on the right). When
// `items` is provided, a category with items expands to show the individual
// sessions/events that make up its time (the History drill-down).
export function CategoryDonut({
  segs,
  totalMs,
  items,
  max = 8,
}: {
  segs: CatSeg[];
  totalMs: number;
  items?: Record<string, CategoryItem[]>;
  // Cap on how many category rows to list (donut still reflects everything).
  max?: number;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <Donut
          segments={segs.map((s) => ({ color: s.color, value: s.ms }))}
          size={180}
          stroke={20}
          label={formatDuration(totalMs)}
          labelClassName="text-2xl"
          sub="Tracked"
        />
      </div>
      {segs.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {segs.slice(0, max).map((s, i) => {
            const pct = totalMs > 0 ? Math.round((s.ms / totalMs) * 100) : 0;
            const key = s.id ?? "uncategorized";
            const rowItems = items?.[key] ?? [];
            const canExpand = rowItems.length > 0;
            const isOpen = openKey === key;

            const inner = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate">{s.name}</span>
                  {canExpand && (
                    <ChevronDownIcon
                      className={cn(
                        "text-faint size-3.5 shrink-0 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  )}
                </span>
                <span className="text-caption shrink-0 font-mono text-xs tabular-nums">
                  {fmtH(s.ms)} · {pct}%
                </span>
              </>
            );

            return (
              <li key={i} className="flex flex-col gap-1">
                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm"
                  >
                    {inner}
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    {inner}
                  </div>
                )}
                <div className="bg-track h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
                {isOpen && canExpand && (
                  <ul className="mt-1 flex max-h-64 flex-col gap-1.5 overflow-y-auto py-1 pl-3.5">
                    {rowItems.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{it.title}</span>
                          <span className="text-caption bg-muted shrink-0 rounded px-1 py-px text-[10px] uppercase tracking-wide">
                            {SOURCE_LABEL[it.source]}
                          </span>
                        </span>
                        <span className="text-caption flex shrink-0 items-baseline gap-1.5">
                          <span>{itemDate(it.startMs)}</span>
                          <span className="font-mono tabular-nums">
                            {fmtH(it.ms)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
