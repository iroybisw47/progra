"use client";

import { CATEGORY_COLORS } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

// The 12-swatch palette grid used by the category and habit edit dialogs.
// Tapping the selected swatch again clears the color (null).
export function ColorSwatches({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-label={c.name}
          aria-pressed={value === c.value}
          onClick={() => onChange(value === c.value ? null : c.value)}
          className={cn(
            "size-8 rounded-full transition-transform hover:scale-110",
            value === c.value &&
              "ring-foreground ring-offset-background scale-110 ring-2 ring-offset-2"
          )}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  );
}
