import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

// Seven bars — a week — breathing out of phase in the palette's colours. The
// ambient motion on the login screen and the Done splash. No hooks, so a
// Server Component can render it; the reduced-motion CSS rule stills it.
//
// One bar per colour with its own period and offset (the design's values), so
// the strip never falls into lockstep.
const BARS: { color: string; duration: number; delay: number }[] = [
  { color: "var(--cat-blue)", duration: 5.4, delay: 0 },
  { color: "var(--cat-teal)", duration: 6.1, delay: 0.7 },
  { color: "var(--cat-forest)", duration: 5.7, delay: 1.4 },
  { color: "var(--cat-mustard)", duration: 6.4, delay: 2.1 },
  { color: "var(--cat-indigo)", duration: 5.5, delay: 2.8 },
  { color: "var(--cat-burnt)", duration: 6.2, delay: 3.5 },
  { color: "var(--cat-plum)", duration: 5.9, delay: 4.2 },
];

export function WeekPulse({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("flex h-[30px] items-end gap-1.5", className)}
      style={style}
    >
      {BARS.map((bar) => (
        <span
          key={bar.color}
          className="h-full flex-1 origin-bottom rounded-[3px]"
          style={{
            backgroundColor: bar.color,
            animation: `bar-pulse ${bar.duration}s ease-in-out ${bar.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
