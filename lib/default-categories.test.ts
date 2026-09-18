import { describe, expect, it } from "vitest";

import {
  DEFAULT_CATEGORIES,
  SEEDED_SYSTEM_FILLS,
} from "@/lib/default-categories";
import { PALETTE, isPaletteFill, normalizeFill } from "@/lib/palette";

describe("DEFAULT_CATEGORIES", () => {
  it("is the four starter categories", () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toEqual([
      "Class",
      "Study",
      "Meetings",
      "Personal",
    ]);
  });

  // A color off the palette fails the action's isPaletteFill guard on any later
  // edit, and reads back as null (→ neutral grey) through normalizeFill.
  it("only uses current palette fills", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(isPaletteFill(c.color), `${c.name} (${c.color})`).toBe(true);
      expect(normalizeFill(c.color)).toBe(c.color);
    }
  });

  // These four sit next to each other as donut arcs more than any other set in
  // the app, so a duplicate would be invisible rather than merely dull.
  it("gives each category a distinct color", () => {
    const fills = DEFAULT_CATEGORIES.map((c) => c.color);
    expect(new Set(fills).size).toBe(fills.length);
  });

  // Seeding matches on lowercased names; two defaults colliding there would
  // silently drop one.
  it("has no case-insensitive duplicate names", () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("names a real palette color for each", () => {
    const byFill = new Map(PALETTE.map((p) => [p.fill, p.name]));
    expect(DEFAULT_CATEGORIES.map((c) => byFill.get(c.color))).toEqual([
      "Dark blue",
      "Green",
      "Orange",
      "Purple",
    ]);
  });
});

describe("SEEDED_SYSTEM_FILLS", () => {
  it("covers every default category, keyed by lowercased name", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(SEEDED_SYSTEM_FILLS[c.name.toLowerCase()]).toBeTypeOf("string");
    }
    expect(Object.keys(SEEDED_SYSTEM_FILLS).sort()).toEqual(
      DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase()).sort()
    );
  });

  // The reason the recolor exists: these hexes are off-palette, so they read
  // back as null and render as the neutral grey. If one ever became a palette
  // fill, the row would already be fine and rewriting it would be meddling.
  it("holds only off-palette hexes", () => {
    for (const [name, hex] of Object.entries(SEEDED_SYSTEM_FILLS)) {
      expect(isPaletteFill(hex), name).toBe(false);
      expect(normalizeFill(hex), name).toBeNull();
    }
  });

  // A system default that equalled its target would make the recolor a no-op
  // and silently leave the category grey.
  it("never matches the color it is corrected to", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(SEEDED_SYSTEM_FILLS[c.name.toLowerCase()].toLowerCase()).not.toBe(
        c.color.toLowerCase()
      );
    }
  });

  // Two categories sharing a default hex would make the guard ambiguous.
  it("gives each category a distinct system default", () => {
    const hexes = Object.values(SEEDED_SYSTEM_FILLS).map((h) => h.toLowerCase());
    expect(new Set(hexes).size).toBe(hexes.length);
  });
});
