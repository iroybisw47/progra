// The fixed 12-swatch palette a category's color is picked from. Muted hues
// chosen to stay readable as small dots on both the light surfaces and the
// clock screen's warm-charcoal dark mode. `categories.color` stores the hex
// value directly (or null = no color); the palette is validated server-side
// in updateCategory so freehand values can't drift in.

export type CategoryColor = {
  name: string;
  value: string;
};

export const CATEGORY_COLORS: CategoryColor[] = [
  { name: "Clay", value: "#c96f5e" },
  { name: "Terracotta", value: "#d08c4a" },
  { name: "Amber", value: "#c7a23a" },
  { name: "Olive", value: "#8fa04f" },
  { name: "Moss", value: "#6b9459" },
  { name: "Teal", value: "#4f9b8c" },
  { name: "Cyan", value: "#58a3b4" },
  { name: "Blue", value: "#5f87c0" },
  { name: "Indigo", value: "#7d76c4" },
  { name: "Plum", value: "#a56fa8" },
  { name: "Rose", value: "#c06f8d" },
  { name: "Stone", value: "#8d8778" },
];

export function isCategoryColor(value: string): boolean {
  return CATEGORY_COLORS.some((c) => c.value === value);
}
