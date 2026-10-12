import { anim, EASE } from "@/lib/recap-story-nav";
import type { RecapStoryView } from "@/lib/recap-story";

import { stopStory } from "./slide-frame";

const LINE_1 = ["It’s", "time", "for", "a", "new", "week."];
const LINE_2 = ["Let’s", "go!"];
const WORD_START = 0.6;
const WORD_STAGGER = 0.075;

// 07 · Closing: navy floods up from the bottom, the headline rises word by
// word in the top goal's colour, the week's quote, and the one way out besides
// the X — straight to the Clock tab.
export function ClosingSlide({
  closing,
  onStart,
  pending,
}: {
  closing: RecapStoryView["closing"];
  onStart: () => void;
  pending: boolean;
}) {
  const line2Start = WORD_START + LINE_1.length * WORD_STAGGER + 0.12;
  return (
    <section
      aria-label="A new week"
      className="bg-brand-deep absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ animation: anim("flood", 0.75, 0, EASE.inOut) }}
    >
      <div
        className="flex min-h-full flex-col px-7"
        style={{
          paddingTop: "calc(var(--rs-top) + 40px)",
          paddingBottom: "calc(var(--rs-bottom) + 12px)",
        }}
      >
        <div className="flex flex-1 flex-col justify-center gap-10 pb-6">
          <h1
            className="m-0 font-serif text-[52px] leading-[1.02] font-medium tracking-[-0.025em]"
            style={{ color: closing.accent }}
          >
            {[LINE_1, LINE_2].map((line, l) => (
              <span key={l} className="flex flex-wrap">
                {line.map((word, i) => (
                  <span
                    key={i}
                    className="mr-[.2em] inline-block"
                    style={{
                      animation: anim("word", 0.55, (l === 0 ? WORD_START : line2Start) + i * WORD_STAGGER),
                    }}
                  >
                    {word}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <figure className="m-0 flex flex-col gap-3" style={{ animation: anim("rise", 0.6, 1.45) }}>
            <blockquote className="m-0 font-serif text-[21px] leading-[1.35] text-white/86 italic">
              “{closing.quote.text}”
            </blockquote>
            <figcaption className="text-[10px] leading-none font-semibold tracking-[.14em] text-white/50 uppercase">
              {closing.quote.author}
            </figcaption>
          </figure>
        </div>
        <div onPointerDown={stopStory} onPointerUp={stopStory} style={{ animation: anim("rise", 0.6, 1.85) }}>
          <button
            type="button"
            onClick={onStart}
            disabled={pending}
            className="text-brand-deep flex h-[52px] w-full items-center justify-center rounded-[15px] border-0 bg-white font-sans text-base font-semibold transition-transform duration-150 active:scale-[.98]"
          >
            Start your next session
          </button>
        </div>
      </div>
    </section>
  );
}
