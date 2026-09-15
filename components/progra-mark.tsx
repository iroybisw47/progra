import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

// How the clock hands move.
//   none  — static, hands at 12 and 4 (the app icon).
//   spin  — quick sweep, for a loading state.
//   drift — real-clock proportions, slowed: the minute hand once every 9s,
//           the hour hand once every 96s from its 4 o'clock start. The
//           login/welcome brand mark.
type Motion = "none" | "spin" | "drift";

const HAND_BASE: CSSProperties = {
  transformBox: "view-box",
  transformOrigin: "50px 50px",
};

// The Progra brand mark: a lucide-style clock on a navy (--brand) rounded
// square, rebuilt as inline SVG so the hands can animate. Static by default
// (hands at 12 & 4, matching the app icon). `animated` is the older spelling
// of motion="spin", kept for PrograLoader. Theme-aware — the square follows
// --brand.
export function PrograMark({
  size = 58,
  animated = false,
  motion,
  className,
  style,
}: {
  size?: number;
  animated?: boolean;
  motion?: Motion;
  className?: string;
  style?: CSSProperties;
}) {
  const mode: Motion = motion ?? (animated ? "spin" : "none");
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Progra"
      className={cn("rounded-[28%]", className)}
      style={style}
    >
      <rect x="0" y="0" width="100" height="100" rx="28" fill="var(--brand)" />
      {/* clock ring */}
      <circle cx="50" cy="50" r="22" fill="none" stroke="#fff" strokeWidth="4.5" />
      <g stroke="#fff" strokeWidth="4.5" strokeLinecap="round">
        {/* hour hand — 4 o'clock at rest. In drift mode the offset is the CSS
            `rotate` property, which composes with the animated transform. */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="38"
          transform={mode === "none" ? "rotate(120 50 50)" : undefined}
          style={
            mode === "spin"
              ? { ...HAND_BASE, animation: "progra-spin 6s linear infinite" }
              : mode === "drift"
                ? {
                    ...HAND_BASE,
                    rotate: "120deg",
                    animation: "progra-spin 96s linear infinite",
                  }
                : undefined
          }
        />
        {/* minute hand — 12 o'clock at rest */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="30"
          style={
            mode === "spin"
              ? { ...HAND_BASE, animation: "progra-spin 1.4s linear infinite" }
              : mode === "drift"
                ? { ...HAND_BASE, animation: "progra-spin 9s linear infinite" }
                : undefined
          }
        />
      </g>
    </svg>
  );
}

// Centered branded loader: the clock mark with sweeping hands, gently rising.
// Use as a Suspense/route-loading fallback.
export function PrograLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-24">
      <PrograMark
        size={72}
        animated
        className="shadow-[0_10px_26px_rgba(28,58,94,.22)]"
      />
      {label && <p className="text-caption text-sm">{label}</p>}
    </div>
  );
}
