// The fixed swatch palette a category / goal / habit color is picked from.
// These nine hues are the redesign's only accent colors — an entity keeps its
// own color everywhere it appears (dot, bar, pill, selected border).
// `categories.color` stores the hex value directly (or null = no color); the
// palette is validated server-side in updateCategory so freehand values can't
// drift in.

export type CategoryColor = {
  name: string;
  value: string;
};

export const CATEGORY_COLORS: CategoryColor[] = [
  { name: "Brick", value: "#9C5148" },
  { name: "Burnt orange", value: "#B0703C" },
  { name: "Mustard", value: "#A98A38" },
  { name: "Olive", value: "#7D8850" },
  { name: "Forest", value: "#4E7A5F" },
  { name: "Deep teal", value: "#46808A" },
  { name: "Blue", value: "#4A6FA5" },
  { name: "Indigo", value: "#6B639C" },
  { name: "Plum", value: "#91607F" },
];

// The previous 12-swatch palette. Beta users already have categories stored in
// these hues, so they stay valid on write — otherwise re-saving an untouched
// old category (the edit dialog sends the current color back) would be
// rejected. They're gone from the picker, so nothing new lands here.
const LEGACY_CATEGORY_COLORS = [
  "#c96f5e",
  "#d08c4a",
  "#c7a23a",
  "#8fa04f",
  "#6b9459",
  "#4f9b8c",
  "#58a3b4",
  "#5f87c0",
  "#7d76c4",
  "#a56fa8",
  "#c06f8d",
  "#8d8778",
];

export function isCategoryColor(value: string): boolean {
  return (
    CATEGORY_COLORS.some((c) => c.value === value) ||
    LEGACY_CATEGORY_COLORS.includes(value)
  );
}
