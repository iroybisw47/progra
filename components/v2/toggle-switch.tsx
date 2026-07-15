"use client";

import { cn } from "@/lib/utils";

// The V2 pill switch (matches the handoff's 44×26 toggle). Used for the live
// timer's "still running" control and the finish screen's privacy toggle.
export function ToggleSwitch({
  id,
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-[26px] w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-brand" : "bg-track"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-transform duration-200",
          checked && "translate-x-[18px]"
        )}
      />
    </button>
  );
}
