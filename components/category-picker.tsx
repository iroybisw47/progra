"use client";

import { entityColor } from "@/lib/colors";
import { type Category } from "@/lib/storage";

type CategoryPickerProps = {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint?: string;
};

// Single-select category pills. The selected pill fills with the category's own
// color; the rest carry a hairline border and their color as a small square, so
// the list reads as the same nine hues used everywhere else.
export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  emptyHint = "Add a category below to get started.",
}: CategoryPickerProps) {
  if (categories.length === 0) {
    return <p className="text-caption text-sm">{emptyHint}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((cat) => (
        <PickerPill
          key={cat.id}
          label={cat.name}
          color={entityColor(cat.color)}
          selected={selectedId === cat.id}
          onSelect={() => onSelect(cat.id)}
        />
      ))}
    </div>
  );
}

// Shared by CategoryPicker and GoalPicker — one pill, two states.
export function PickerPill({
  label,
  color,
  selected,
  onSelect,
}: {
  label: string;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-transform active:scale-95"
      style={{
        borderColor: selected ? color : "var(--hairline)",
        backgroundColor: selected ? color : "var(--card)",
        color: selected ? "#fff" : "var(--body)",
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: selected ? "rgba(255,255,255,.85)" : color }}
      />
      {label}
    </button>
  );
}
