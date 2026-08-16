"use client";

import { CheckIcon } from "lucide-react";

import { CATEGORY_COLORS } from "@/lib/category-colors";

// The nine-swatch palette row used by the category, goal and habit editors.
// Each swatch is a filled tile; the selected one carries a ring in its own
// color. Tapping the selected swatch again clears the color (null).
export function ColorSwatches({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {CATEGORY_COLORS.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            aria-label={c.name}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : c.value)}
            className="flex h-[38px] flex-1 items-center justify-center rounded-[11px] text-white transition-transform duration-150 active:scale-[.92]"
            style={{
              backgroundColor: c.value,
              boxShadow: selected
                ? `0 0 0 2px var(--screen), 0 0 0 4px ${c.value}`
                : undefined,
            }}
          >
            {selected && <CheckIcon className="size-4" strokeWidth={3.4} />}
          </button>
        );
      })}
    </div>
  );
}
