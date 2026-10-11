"use client";

import { cn } from "@/lib/utils";

// The V2 pill switch (matches the handoff's 44×26 toggle). Used for the live
// timer's "still running" control and the finish screen's privacy toggle.
export function ToggleSwitch({
  id,
  checked,
  onCheckedChange,
  ariaLabel,
  labelledBy,
  describedBy,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  ariaLabel?: string;
  // The id of visible text that names the switch, in place of ariaLabel, so
  // its spoken name is the words on screen (the Settings UW block).
  labelledBy?: string;
  // The id of text saying what the switch changes, read after its state.
  describedBy?: string;
  // A real `disabled` attribute, not just dimming: the state has to be
  // announced to a screen reader and the control has to stop taking taps.
  // The finish screen uses it for an auto-ended session, which is worth 0
  // hours and so has nothing to share either way.
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-[26px] w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-brand" : "bg-track",
        disabled && "cursor-not-allowed"
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
