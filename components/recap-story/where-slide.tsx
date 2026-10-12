import type { CSSProperties } from "react";

import { anim, DONUT, donutArcs } from "@/lib/recap-story-nav";
import type { WhereView } from "@/lib/recap-story";

import { SlideFrame, SlideTitle } from "./slide-frame";

// 02 · Where it went (kept from today's story, restyled): the category donut,
// drawn as one continuous clockwise stroke, then each category's bar.
export function WhereSlide({ where }: { where: WhereView }) {
  const arcs = donutArcs(where.segments.map((s) => s.share));
  const mid = DONUT.size / 2;
  return (
    <SlideFrame label="Where it went">
      <SlideTitle title="Where it went" sub={where.countLabel} />
      <div className="mt-[22px] flex flex-1 flex-col justify-center gap-[26px] pb-3">
        <div className="flex justify-center">
          <div className="relative size-[180px] shrink-0">
            <svg
              width={DONUT.size}
              height={DONUT.size}
              viewBox={`0 0 ${DONUT.size} ${DONUT.size}`}
              className="block -rotate-90"
              aria-hidden
            >
              <circle
                cx={mid}
                cy={mid}
                r={DONUT.r}
                fill="none"
                stroke="var(--track)"
                strokeWidth={DONUT.stroke}
                style={{ animation: anim("fade", 0.4, 0.1, "ease") }}
              />
              {arcs.map((a, i) => (
                <circle
                  key={i}
                  cx={mid}
                  cy={mid}
                  r={DONUT.r}
                  fill="none"
                  stroke={where.segments[i].color}
                  strokeWidth={DONUT.stroke}
                  style={
                    {
                      "--c": a.c,
                      strokeDasharray: a.dash,
                      strokeDashoffset: a.offset,
                      animation: anim("ring", a.durationS, a.delayS, "linear"),
                    } as CSSProperties
                  }
                />
              ))}
            </svg>
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-[3px]"
              style={{ animation: anim("fade", 0.5, 1.05, "ease") }}
            >
              <span className="text-ink text-2xl leading-none font-semibold whitespace-nowrap tabular-nums">
                {where.totalLabel}
              </span>
              <span className="text-disabled text-[8px] font-semibold tracking-[.12em] uppercase">
                Tracked
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {where.rows.map((r, i) => {
            const delay = 0.75 + i * 0.08;
            return (
              <div key={r.key} className="flex flex-col gap-1" style={{ animation: anim("rise", 0.45, delay) }}>
                <div className="flex items-center justify-between gap-2 text-sm leading-5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="truncate">{r.name}</span>
                  </span>
                  {/* nowrap: the handoff's own frame wraps "5.0h · 43%" here. */}
                  <span className="text-caption shrink-0 text-xs leading-4 whitespace-nowrap tabular-nums">
                    {r.meta}
                  </span>
                </div>
                <div className="bg-track h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: r.color,
                      width: `${r.widthPct}%`,
                      transformOrigin: "left center",
                      animation: anim("grow", 0.7, delay + 0.12),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}
