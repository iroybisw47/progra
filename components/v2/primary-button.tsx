"use client";

import { cn } from "@/lib/utils";

// The app's navy CTA, in one place.
//
// It existed in nine hand-rolled copies before this: five radii (13/14/15/18/2xl),
// five heights (44/46/50/52/py-4), two shadow recipes, two active scales and
// three disabled opacities — differences nobody chose, accumulated over the weeks
// the screens were built. The values here are whichever variant was already the
// most common, so converting a call site is usually a no-op or a 2px change.
//
// Two sizes, because two contexts genuinely differ:
//   sheet  — inside a bottom sheet, where the button is one element among several
//   screen — the pinned CTA a whole screen exists to press (Clock in, Continue),
//            which is taller, larger-typed, and carries the navy glow
//
// Width defaults to full. In a row beside a Delete button, pass `className="flex-1"`.
export function PrimaryButton({
  size = "sheet",
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { size?: "sheet" | "screen" }) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        "bg-brand text-primary-foreground w-full font-semibold transition-transform active:scale-[.98] disabled:opacity-50",
        "flex items-center justify-center gap-1.5 rounded-[15px]",
        size === "screen"
          ? "h-[52px] text-base shadow-[0_10px_22px_-10px_rgba(28,58,94,.55)] disabled:shadow-none"
          : "h-12 text-sm",
        className
      )}
    />
  );
}
