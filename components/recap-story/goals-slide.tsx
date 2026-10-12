import type { CSSProperties } from "react";
import { CheckIcon } from "lucide-react";

import { anim } from "@/lib/recap-story-nav";
import type { GoalsView } from "@/lib/recap-story";

import { CountUp } from "./count-up";
import { SlideFrame, SlideTitle } from "./slide-frame";

const RING = { size: 172, r: 78, stroke: 13 } as const;
const DONE_WASH = "rgba(38,107,77,.08)";
const DONE_PILL = "rgba(38,107,77,.1)";

// 03 · Weekly goals: one ring for progress across every goal (each capped at
// its quota), the message, a callout for goals that hit 100%, then each goal.
// Navy throughout — nothing on this slide is red.
export function GoalsSlide({ goals, still }: { goals: GoalsView; still: boolean }) {
  const c = 2 * Math.PI * RING.r;
  const len = Math.min(1, goals.pct / 100) * c;
  const mid = RING.size / 2;
  return (
    <SlideFrame label="Weekly goals">
      <SlideTitle title="Weekly goals" sub={goals.meta} />
      <div className="flex flex-1 flex-col items-center justify-center gap-[18px] pt-1 pb-3.5">
        <div
          className="relative size-[172px] shrink-0"
          style={{ animation: goals.complete ? "rc-settle .5s ease-in-out 1.75s" : undefined }}
        >
          <svg
            width={RING.size}
            height={RING.size}
            viewBox={`0 0 ${RING.size} ${RING.size}`}
            className="block -rotate-90"
            aria-hidden
          >
            <circle
              cx={mid}
              cy={mid}
              r={RING.r}
              fill="none"
              stroke="var(--track)"
              strokeWidth={RING.stroke}
              style={{ animation: anim("fade", 0.4, 0.1, "ease") }}
            />
            {len > 0 && (
              <circle
                cx={mid}
                cy={mid}
                r={RING.r}
                fill="none"
                stroke="var(--brand)"
                strokeWidth={RING.stroke}
                strokeLinecap="round"
                style={
                  {
                    "--c": c,
                    strokeDasharray: `${len.toFixed(2)} ${c.toFixed(2)}`,
                    animation: anim("ring", 1.4, 0.3),
                  } as CSSProperties
                }
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-ink font-serif text-[54px] leading-[.85] font-medium tracking-[-0.035em] whitespace-nowrap tabular-nums">
              <CountUp to={goals.pct} durationMs={1400} delayMs={300} still={still} />
              <span className="text-secondary-ink text-[26px] tracking-[-0.01em]">%</span>
            </span>
            <span
              className="text-disabled text-[9px] font-semibold tracking-[.12em] whitespace-nowrap uppercase"
              style={{ animation: anim("fade", 0.4, 0.6, "ease") }}
            >
              {goals.caption}
            </span>
          </div>
        </div>
        <p
          className="text-ink m-0 max-w-[310px] text-center font-serif text-[21px] leading-[1.22] font-medium tracking-[-0.015em] text-balance"
          style={{ animation: anim("rise", 0.5, 1.25) }}
        >
          {goals.message}
        </p>
      </div>

      {goals.doneCopy && (
        <div
          className="mb-[18px] flex items-center gap-3.5 rounded-[25.92px] px-[18px] py-3.5"
          style={{ background: DONE_WASH, animation: anim("rise", 0.55, 1.5) }}
        >
          <span
            className="bg-done flex size-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ animation: anim("check", 0.4, 1.8, "ease") }}
          >
            <CheckIcon size={18} strokeWidth={3} aria-hidden />
          </span>
          <p className="text-ink m-0 font-serif text-[19px] leading-[1.25] font-medium tracking-[-0.01em] text-pretty">
            {goals.doneCopy}
          </p>
        </div>
      )}

      <div
        className="border-hairline flex flex-col gap-3 border-t pt-3.5"
        style={{ animation: anim("rise", 0.5, 1.65) }}
      >
        <span className="text-faint text-[10px] leading-none font-semibold tracking-[.14em] whitespace-nowrap uppercase">
          By goal
        </span>
        <div className="flex flex-col gap-[11px]">
          {goals.rows.map((g, i) => (
            <div key={g.id} className="flex flex-col gap-[5px]">
              <div className="flex items-center gap-2">
                <span className="size-[9px] shrink-0 rounded-[2px]" style={{ background: g.color }} />
                <span className="text-body min-w-0 truncate text-sm font-semibold">{g.title}</span>
                {g.done && (
                  <span
                    className="text-done flex shrink-0 items-center gap-[3px] rounded-full py-0.5 pr-2 pl-1.5 text-[10.5px] font-bold tracking-[.02em]"
                    style={{ background: DONE_PILL, animation: anim("check", 0.4, 2.35 + i * 0.08, "ease") }}
                  >
                    <CheckIcon size={11} strokeWidth={3.4} aria-hidden />
                    100%
                  </span>
                )}
                <span className="flex-1" />
                <span className="text-ink shrink-0 text-sm font-semibold tabular-nums">{g.actual}</span>
                <span className="text-caption shrink-0 text-xs whitespace-nowrap tabular-nums">
                  / {g.quota}
                </span>
              </div>
              <div className="bg-track h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    background: g.color,
                    width: `${g.widthPct}%`,
                    transformOrigin: "left center",
                    animation: anim("grow", 0.8, 1.75 + i * 0.08),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
