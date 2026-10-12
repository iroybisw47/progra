import { anim } from "@/lib/recap-story-nav";
import type { RecapStoryView } from "@/lib/recap-story";

import { CountUp } from "./count-up";
import { SlideFrame, SlideTitle } from "./slide-frame";

// 01 · Hours tracked: the week's one big number, then a neutral line against
// the user's own average (no red, no arrows, either way).
export function HoursSlide({
  hours,
  weekSpanLabel,
  still,
}: {
  hours: RecapStoryView["hours"];
  weekSpanLabel: string;
  still: boolean;
}) {
  return (
    <SlideFrame label="Hours tracked">
      <SlideTitle title="Hours tracked" sub={weekSpanLabel} />
      <div className="flex flex-1 flex-col justify-center gap-[26px] pb-9">
        <div
          className="flex items-baseline gap-2.5"
          style={{ transformOrigin: "left bottom", animation: anim("scale", 0.6, 0.25) }}
        >
          <span
            className="text-ink font-serif leading-[.85] font-medium tracking-[-0.045em] tabular-nums"
            // 148px is the 402pt artboard; narrower phones scale it so "11.5 hrs"
            // never wraps (and 100+ steps down to 112).
            style={{ fontSize: hours.large ? "min(112px, 27.9vw)" : "min(148px, 36.8vw)" }}
          >
            <CountUp to={hours.value} decimals={1} durationMs={1300} delayMs={300} still={still} />
          </span>
          <span
            className="text-secondary-ink font-serif text-[40px] font-medium tracking-[-0.02em]"
            style={{ animation: anim("fade", 0.5, 1.25, "ease") }}
          >
            hrs
          </span>
        </div>
        {hours.line && (
          <p
            className="text-body m-0 text-[17px] leading-[1.4] text-pretty"
            style={{ animation: anim("rise", 0.5, 1.45) }}
          >
            {hours.line}
          </p>
        )}
      </div>
    </SlideFrame>
  );
}
