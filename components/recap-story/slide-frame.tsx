import type { CSSProperties, ReactNode } from "react";

import { anim } from "@/lib/recap-story-nav";
import { cn } from "@/lib/utils";

// One slide's frame: absolute over the story, its content starting under the
// header (safe area + 40px: 28px header row + 12px gap) and stopping above the
// home indicator. --rs-top / --rs-bottom are set on the story root.
//
// The frame SCROLLS rather than clipping: the design holds at a 390pt-wide
// iPhone, but a short phone (SE), a long friend list or a dozen habits would
// otherwise push content off the bottom. min-h-full keeps the flex-1 regions
// centring exactly as designed whenever everything fits.
export function SlideFrame({
  label,
  children,
  gutter = true,
  className,
  style,
}: {
  label: string;
  children: ReactNode;
  gutter?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      aria-label={label}
      className="absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        className={cn("flex min-h-full flex-col", gutter && "px-6", className)}
        style={{
          paddingTop: "calc(var(--rs-top) + 40px)",
          paddingBottom: "calc(var(--rs-bottom) + 10px)",
          ...style,
        }}
      >
        {children}
      </div>
    </section>
  );
}

// The slide's headline — the story is the design system's documented exception
// to "no big headlines" — and its caption line.
export function SlideTitle({
  title,
  sub,
  className,
}: {
  title: string;
  sub: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} style={{ animation: anim("rise", 0.5, 0.05) }}>
      <h2 className="text-ink m-0 font-serif text-[36px] leading-[1.04] font-medium tracking-[-0.022em]">
        {title}
      </h2>
      <span className="text-caption text-[13px] leading-[1.3] whitespace-nowrap">{sub}</span>
    </div>
  );
}

// Stops a pointer on a control from also counting as a tap on the story.
export function stopStory(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}
