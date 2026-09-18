"use client";

import { CheckIcon } from "lucide-react";

import { PALETTE } from "@/lib/palette";

// The eleven-swatch palette row used by the category, goal and habit editors
// and by onboarding — every color picker in the app shows all eleven, in
// palette order, maroon first. Each swatch is a tile filled with its own color;
// the selected one carries a 1.5px border in that same color and a white check.
// Tapping the selected swatch again clears the color (null).
export function ColorSwatches({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {PALETTE.map((c) => {
        const selected = value === c.fill;
        return (
          <button
            key={c.fill}
            type="button"
            aria-label={c.name}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : c.fill)}
            className="flex h-[38px] flex-1 items-center justify-center rounded-[11px] border-[1.5px] text-white transition-transform duration-150 active:scale-[.92]"
            style={{
              backgroundColor: c.fill,
              // Selected: the entity's own color. Unselected: the shared
              // hairline. The white check is what reads as "picked" on a tile
              // already filled with the color.
              borderColor: selected ? c.fill : "#e6e9ed",
            }}
          >
            {selected && <CheckIcon className="size-4" strokeWidth={3.4} />}
          </button>
        );
      })}
    </div>
  );
}
