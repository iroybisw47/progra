"use client";

// The quiet link under the CTA (R:36): "Skip for now" on the habits, "Skip" on
// How Progra works' first three steps, "Not now" on notifications. Centered,
// 14px off the bottom of the 852 frame (its home indicator's 34px less 20),
// and never below the screen's edge where there's no indicator. One for the
// whole wizard, as the CTA is, crossfading over 180ms as the screens change
// it. Null hides it.
export type SkipSpec = { label: string; disabled?: boolean; onPress: () => void } | null;

export function SkipLink({ spec }: { spec: SkipSpec }) {
  const shown = spec !== null;
  return (
    <button
      type="button"
      onClick={() => {
        if (spec && !spec.disabled) spec.onPress();
      }}
      disabled={!shown || spec?.disabled}
      tabIndex={shown ? undefined : -1}
      aria-hidden={!shown || undefined}
      className="text-caption hover:text-brand absolute left-1/2 z-10 -translate-x-1/2 px-3 text-[12px] leading-[18px] font-medium whitespace-nowrap transition-colors disabled:cursor-default"
      style={{
        bottom: "max(calc(env(safe-area-inset-bottom) - 20px), 2px)",
        opacity: shown ? (spec.disabled ? 0.4 : 1) : 0,
        pointerEvents: shown ? "auto" : "none",
        transition: "opacity 180ms linear, color 150ms ease",
      }}
    >
      {spec?.label ?? ""}
    </button>
  );
}
