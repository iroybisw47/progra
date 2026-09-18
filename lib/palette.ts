// The app's entity color palette — the one place a category / goal / habit /
// avatar hue is defined. Eleven colors, picked from in this exact order by
// every color picker in the app (goal setup, category editor, habit editor,
// onboarding).
//
// Two values per color:
//   fill — dots, bars, donut arcs, borders, selected-state fills, avatar chips
//   ink  — ONLY when the color appears as text on white (a checked habit
//          label, a kudos count, a leaderboard delta). Never render `fill` as
//          text; it doesn't carry enough contrast at body sizes.
//
// Glyphs *inside* a filled chip (check marks, icons) are always white, on
// every one of the eleven.

export type PaletteColor = {
  name: string;
  fill: string;
  ink: string;
};

export const PALETTE: PaletteColor[] = [
  { name: "Maroon", fill: "#8E3A44", ink: "#6E2530" },
  { name: "Red", fill: "#DE5148", ink: "#BE362D" },
  { name: "Orange", fill: "#E07042", ink: "#C24E14" },
  { name: "Gold", fill: "#D6A728", ink: "#8F6C0A" },
  { name: "Light green", fill: "#7CBE6D", ink: "#356B2F" },
  { name: "Green", fill: "#2E8B50", ink: "#175E33" },
  { name: "Light blue", fill: "#77B7C6", ink: "#22758C" },
  { name: "Dark blue", fill: "#395AA0", ink: "#33518F" },
  { name: "Purple", fill: "#A084B3", ink: "#7A57A0" },
  { name: "Dark purple", fill: "#6F4E93", ink: "#533672" },
  { name: "Pink", fill: "#D06DA1", ink: "#BA4485" },
];

// Older stored hues → their nearest color in the palette above.
//
// Entity colors are stored as hex (not an index), so rather than migrate three
// live tables we normalize on the way out of `lib/db/*`: a row written under
// any previous palette reads back as the palette color it maps to, and the
// next save persists the new hex. Nothing to run against prod, and dropping
// this map is all it takes to go back.
//
// The first nine are the palette this replaced; the rest are the 12-swatch set
// that preceded *it*, still sitting on beta users' rows.
const LEGACY_FILLS: Record<string, string> = {
  // Previous nine-hue palette.
  "#9c5148": "#8E3A44", // Brick        → Maroon
  "#b0703c": "#E07042", // Burnt orange → Orange
  "#a98a38": "#D6A728", // Mustard      → Gold
  "#7d8850": "#7CBE6D", // Olive        → Light green
  "#4e7a5f": "#2E8B50", // Forest       → Green
  "#46808a": "#77B7C6", // Deep teal    → Light blue
  "#4a6fa5": "#395AA0", // Blue         → Dark blue
  "#6b639c": "#6F4E93", // Indigo       → Dark purple
  "#91607f": "#D06DA1", // Plum         → Pink
  // The 12-swatch palette before that.
  "#c96f5e": "#DE5148",
  "#d08c4a": "#E07042",
  "#c7a23a": "#D6A728",
  "#8fa04f": "#7CBE6D",
  "#6b9459": "#2E8B50",
  "#4f9b8c": "#2E8B50",
  "#58a3b4": "#77B7C6",
  "#5f87c0": "#395AA0",
  "#7d76c4": "#6F4E93",
  "#a56fa8": "#A084B3",
  "#c06f8d": "#D06DA1",
  "#8d8778": "#7CBE6D",
};

// A stored hex as the palette fill it is today: already-current values pass
// through, retired ones map forward, anything unrecognized returns null so the
// caller falls back to its neutral.
export function normalizeFill(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const key = hex.trim().toLowerCase();
  const current = PALETTE.find((c) => c.fill.toLowerCase() === key);
  if (current) return current.fill;
  return LEGACY_FILLS[key] ?? null;
}

// Is this a hex the app is willing to store? Only the eleven current fills —
// reads normalize retired hues before they ever reach an edit dialog, so a
// save always carries a current value.
export function isPaletteFill(hex: string): boolean {
  return PALETTE.some((c) => c.fill.toLowerCase() === hex.trim().toLowerCase());
}

// The text-safe twin of a fill. Falls back to the fill itself for the neutral
// grey and anything else off-palette.
export function inkFor(hex: string | null | undefined): string {
  const fill = normalizeFill(hex);
  if (!fill) return hex ?? "";
  return PALETTE.find((c) => c.fill === fill)!.ink;
}
