import { anim } from "@/lib/recap-story-nav";
import type { WelcomeView } from "@/lib/recap-story";

import { SlideFrame, SlideTitle } from "./slide-frame";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Welcome (the first review only): what this is and when it comes. Not in the
// handoff, so it's drawn from the story's own parts — the title block, the
// Habits slide's day letters, the Friends slide's 29px serif sentence — with
// the week as seven tiles, Monday's lit navy with its 6am.
export function WelcomeSlide({ welcome, weekSpanLabel }: { welcome: WelcomeView; weekSpanLabel: string }) {
  return (
    <SlideFrame label="Welcome">
      <SlideTitle title={welcome.title} sub={weekSpanLabel} />
      <div className="flex flex-1 flex-col justify-center gap-[30px] pb-9">
        <div aria-hidden className="flex gap-1.5">
          {DAYS.map((letter, i) => {
            const monday = i === 0;
            return (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span
                  className="text-[10px] font-bold tracking-[.06em]"
                  style={{
                    color: monday ? "var(--brand)" : "var(--disabled)",
                    animation: anim("fade", 0.4, 0.25 + i * 0.05, "ease"),
                  }}
                >
                  {letter}
                </span>
                <span
                  className="flex h-12 w-full items-center justify-center rounded-[12px]"
                  style={{
                    background: monday ? "var(--brand)" : "var(--track)",
                    animation: monday
                      ? `${anim("pop", 0.5, 0.3, "ease")}, rc-settle .45s ease-in-out 1.25s`
                      : anim("check", 0.35, 0.35 + i * 0.05, "ease"),
                  }}
                >
                  {monday && (
                    <span className="text-[12px] font-semibold tracking-[.01em] whitespace-nowrap text-white tabular-nums">
                      6am
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p
          className="text-ink m-0 font-serif text-[29px] leading-[1.18] font-medium tracking-[-0.02em] text-pretty"
          style={{ animation: anim("rise", 0.55, 0.75) }}
        >
          {welcome.line}
        </p>
        <p
          className="text-secondary-ink m-0 text-[13.5px] leading-[1.45] text-pretty"
          style={{ animation: anim("rise", 0.5, 1.35) }}
        >
          {welcome.hint}
        </p>
      </div>
    </SlideFrame>
  );
}
