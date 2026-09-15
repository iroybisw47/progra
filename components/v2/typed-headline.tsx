"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

// A headline that types itself in, letter by letter behind a blinking caret —
// the "typed" treatment from the login/onboarding design.
//
// Height-stable: an invisible ghost of the FULL text sits in the flow and
// reserves the space, and the typed slice is painted over it. So nothing
// below jumps as characters arrive, and a two-line headline is two lines
// from the first frame (`whitespace-pre-line` honours the "\n" in the text).
//
// Retypes whenever `text` changes (the inner component is keyed on it), and
// so on every entry to an onboarding step, since the shell remounts steps.
// With "reduce motion" on, the full text is shown at once with no caret.
export function TypedHeadline(props: {
  text: string;
  // Design timings: onboarding 280ms then 32ms/char; login 300ms then 55ms.
  delayMs?: number;
  charMs?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <Typed key={props.text} {...props} />;
}

function Typed({
  text,
  delayMs = 280,
  charMs = 32,
  className,
  style,
}: {
  text: string;
  delayMs?: number;
  charMs?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(0);

  // State only ever changes inside the timer callbacks — never synchronously
  // in the effect body — and both timers are cleared on unmount.
  useEffect(() => {
    if (reduced) return;
    let n = 0;
    let tick: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      tick = setInterval(() => {
        n += 1;
        setCount(n);
        if (n >= text.length && tick) clearInterval(tick);
      }, charMs);
    }, delayMs);
    return () => {
      clearTimeout(start);
      if (tick) clearInterval(tick);
    };
  }, [reduced, text, delayMs, charMs]);

  const done = reduced || count >= text.length;

  return (
    <h1 className={cn("relative whitespace-pre-line", className)} style={style}>
      {/* Read once, in full, by assistive tech; the two visual copies below
          are hidden from it. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden className="invisible">
        {text}
      </span>
      <span aria-hidden className="absolute inset-0">
        {reduced ? text : text.slice(0, count)}
        {!done && (
          <span className="bg-brand ml-[3px] inline-block h-[0.85em] w-[2.5px] animate-[caret-blink_1s_step-end_infinite] rounded-[1px] align-[-0.06em]" />
        )}
      </span>
    </h1>
  );
}
