// Helpers for painting with an entity's own color.
//
// Every category / goal / habit owns one of the eleven palette colors
// (lib/palette.ts) and keeps it everywhere it appears. Filled states (a checked
// habit pill, a selected picker row) use a wash of that same color rather than
// a separate grey, which is what keeps the screens reading as one system
// instead of eleven.

import { PALETTE, inkFor, normalizeFill } from "@/lib/palette";

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

// An entity's color, or the neutral grey used for uncategorized time. Hues
// stored under an earlier palette normalize forward (lib/palette.ts).
export function entityColor(hex: string | null | undefined): string {
  return normalizeFill(hex) ?? FALLBACK;
}

// The same color for use as text on white. Every place a palette color is the
// `color` of a label rather than the fill behind one goes through this.
export function entityInk(hex: string | null | undefined): string {
  const fill = normalizeFill(hex);
  return fill ? inkFor(fill) : FALLBACK;
}

// The same color for use ON A DARK GROUND — the iOS Live Activity's navy card.
//
// A THIRD variant, because neither of the two above works there, and the
// numbers are not close. Measured against the card's #142c49 ground: the raw
// fills put maroon at 1.91:1, dark blue at 2.12 and purple at 2.14 — under the
// 3:1 that even a non-text marker needs, so the bar goes invisible rather than
// merely dim. And entityInk is worse than unhelpful: it DARKENS a color for
// white grounds, which on navy moves it toward the background.
//
// Mixing toward white keeps the hue (so a goal still reads as its own color)
// while lifting lightness until it clears the ground. At 45% every palette
// entry lands at 5.3:1 or better, which covers body text, so one value serves
// both the marker and the elapsed digits.
//
// Deliberately NOT a general dark-mode token: the app is flat white, and this
// exists for the one surface that isn't.
const ON_DARK_MIX = 0.45;

export function entityOnDark(hex: string | null | undefined): string {
  const rgb = parseHex(entityColor(hex)) ?? parseHex(FALLBACK)!;
  const lift = (c: number) => Math.round(c + (255 - c) * ON_DARK_MIX);
  const hexOf = (c: number) => lift(c).toString(16).padStart(2, "0");
  return `#${hexOf(rgb[0])}${hexOf(rgb[1])}${hexOf(rgb[2])}`;
}

// A goal's color: the one its owner picked, or — for goals created before the
// column existed, and anywhere only an id is in hand — a hue derived from the
// id. Deriving keeps it stable across surfaces and devices: same id, same
// color, forever, so an uncolored goal still reads as one thing everywhere.
export function goalColorOf(
  goal: { id: string; color?: string | null } | string
): string {
  if (typeof goal === "string") return goalColor(goal);
  return normalizeFill(goal.color) ?? goalColor(goal.id);
}

export function goalColor(goalId: string): string {
  return PALETTE[hashOf(goalId) % PALETTE.length].fill;
}

// A person's color, for the initials avatar — same idea as goalColor, so a
// friend looks the same in the feed, the leaderboard and their profile.
export function userColor(username: string): string {
  return PALETTE[hashOf(`u:${username}`) % PALETTE.length].fill;
}

function hashOf(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}
