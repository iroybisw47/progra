import { CheckIcon } from "lucide-react";

import { anim } from "@/lib/recap-story-nav";
import type { HabitsView } from "@/lib/recap-story";

import { CountUp } from "./count-up";
import { SlideFrame, SlideTitle } from "./slide-frame";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
// The grid's fixed right-hand geometry: seven 26px cells and a 40px WEEK
// column, 4px apart. The best day's 30px highlight sits behind its column,
// measured from the right edge, which every row shares.
const CELL = 26;
const GAP = 4;
const WEEK_COL = 40;
function bestColumnLeft(index: number): string {
  const fromRight = WEEK_COL + GAP + (6 - index) * (CELL + GAP) + CELL + 2;
  return `calc(100% - ${fromRight}px)`;
}

// 04 · Habits: the week as a day-by-habit checklist (Progress → Week's grid),
// each habit's week percentage, and the best day called out.
export function HabitsSlide({ habits, still }: { habits: HabitsView; still: boolean }) {
  const best = habits.best;
  return (
    <SlideFrame label="Habits">
      <SlideTitle title="Habits" sub={habits.meta} />
      <div className="flex flex-1 flex-col justify-center gap-[26px] pb-5">
        <div className="relative flex flex-col">
          {best && (
            <div
              aria-hidden
              className="absolute -top-2 -bottom-1.5 w-[30px] rounded-[10px]"
              style={{
                left: bestColumnLeft(best.index),
                background: "rgba(28,58,94,.06)",
                animation: anim("fade", 0.5, 1.25, "ease"),
              }}
            />
          )}
          <div aria-hidden className="relative flex items-center gap-1 pb-2">
            <span className="min-w-0 flex-1" />
            {LETTERS.map((letter, j) => (
              <span
                key={j}
                className="w-[26px] shrink-0 text-center text-[10px] font-bold tracking-[.06em]"
                style={{ color: best?.index === j ? "var(--brand)" : "var(--disabled)" }}
              >
                {letter}
              </span>
            ))}
            <span className="text-disabled w-10 shrink-0 text-right text-[9px] font-semibold tracking-[.12em] uppercase">
              Week
            </span>
          </div>
          {habits.rows.map((h, i) => (
            <div
              key={h.id}
              className="border-divider relative flex items-center gap-1 border-t py-[7px]"
              style={{ animation: anim("rise", 0.45, 0.2 + i * 0.07) }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-[7px] pr-1">
                <span className="size-2 shrink-0 rounded-[2px]" style={{ background: h.color }} />
                <span className="text-body min-w-0 truncate text-[13px] font-semibold">{h.name}</span>
              </div>
              <span className="sr-only">{h.summary}</span>
              {h.days.map((done, j) => (
                <span
                  key={j}
                  aria-hidden
                  className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] text-white"
                  style={{
                    border: `1.5px solid ${done ? h.color : "var(--hairline)"}`,
                    background: done ? h.color : "transparent",
                    animation: anim("check", 0.35, 0.35 + j * 0.07 + i * 0.03, "ease"),
                  }}
                >
                  {done && <CheckIcon size={13} strokeWidth={3.4} className="block" />}
                </span>
              ))}
              <span className="text-ink w-10 shrink-0 text-right font-serif text-[19px] leading-none font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums">
                <CountUp to={h.pct} durationMs={700} delayMs={900} still={still} />
                <span className="text-secondary-ink text-[11px] tracking-normal">%</span>
              </span>
            </div>
          ))}
        </div>

        {best && (
          <div
            className="flex items-center gap-3.5 rounded-[25.92px] px-[18px] py-4"
            style={{ background: "rgba(28,58,94,.05)", animation: anim("rise", 0.55, 1.35) }}
          >
            {best.all ? (
              <span
                className="bg-done flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ animation: anim("check", 0.4, 1.65, "ease") }}
              >
                <CheckIcon size={18} strokeWidth={3} aria-hidden />
              </span>
            ) : (
              <span
                aria-hidden
                className="bg-sand text-brand-deep flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-sm font-semibold tabular-nums"
                style={{ animation: anim("check", 0.4, 1.65, "ease") }}
              >
                {best.count}/{best.total}
              </span>
            )}
            <p className="text-ink m-0 font-serif text-[18px] leading-[1.3] font-medium tracking-[-0.01em] text-pretty">
              {best.copy}
            </p>
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
