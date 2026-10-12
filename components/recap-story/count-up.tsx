"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/hooks";
import { easeOutCubic } from "@/lib/recap-story-nav";

// A number counting up from 0 with ease-out cubic, one frame at a time — the
// review's big numbers. A leaf on purpose: only this span re-renders per frame.
// Under reduced motion, and in the preview's still mode, it shows the final
// value outright. Screen readers get the final value only, never the ticks.
export function CountUp({
  to,
  decimals = 0,
  durationMs,
  delayMs = 0,
  still = false,
}: {
  to: number;
  decimals?: number;
  durationMs: number;
  delayMs?: number;
  still?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const instant = still || reduced;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (instant) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now + delayMs;
      const t = (now - start) / durationMs;
      setValue(to * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, delayMs, instant]);

  const shown = instant ? to : value;
  return (
    <>
      <span aria-hidden>{shown.toFixed(decimals)}</span>
      <span className="sr-only">{to.toFixed(decimals)}</span>
    </>
  );
}
