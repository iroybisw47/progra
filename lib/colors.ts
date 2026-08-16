// Helpers for painting with an entity's own color.
//
// Every category / goal / habit owns one of the nine palette hues and keeps it
// everywhere it appears. Filled states (a checked habit pill, a selected
// picker row) use a wash of that same hue rather than a separate grey, which is
// what keeps the screens reading as one system instead of nine.

const FALLBACK = "#9fa6b0";

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// A translucent wash of `hex` — the fill behind a checked pill or selected row.
export function tint(hex: string | null, alpha = 0.12): string {
  const rgb = parseHex(hex ?? FALLBACK) ?? parseHex(FALLBACK)!;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

// An entity's color, or the neutral grey used for uncategorized time.
export function entityColor(hex: string | null | undefined): string {
  return hex ?? FALLBACK;
}

// Goals have no stored color (categories and habits do), but the design gives
// every goal its own hue — the same one on Progress, You, the leaderboard
// expansion and a friend's profile. Derive it from the goal id so it's stable
// across surfaces and devices without a schema change: same id, same color,
// forever.
export function goalColor(goalId: string): string {
  let hash = 0;
  for (let i = 0; i < goalId.length; i++) {
    hash = (hash * 31 + goalId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

// Kept in sync with CATEGORY_COLORS (lib/category-colors.ts) — the values, not
// the import, so this stays free of the picker's naming.
const PALETTE = [
  "#9C5148",
  "#B0703C",
  "#A98A38",
  "#7D8850",
  "#4E7A5F",
  "#46808A",
  "#4A6FA5",
  "#6B639C",
  "#91607F",
];
