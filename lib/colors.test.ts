import { describe, expect, it } from "vitest";

import { entityColor, entityInk, entityOnDark } from "@/lib/colors";
import { PALETTE } from "@/lib/palette";

// PALETTE entries are { name, fill, ink }; every assertion here is about fills.
const FILLS = PALETTE.map((c) => c.fill);

// The navy ground of the iOS Live Activity's dark card (--brand-deep). Every
// assertion below is against THIS value; the lighter --brand (#1c3a5e) drops
// maroon to 4.35:1, which is why the card uses the deeper one.
const DARK_GROUND = "#142c49";

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// WCAG 2.1 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const srgb = parse(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("entityOnDark", () => {
  // THE REASON THIS FUNCTION EXISTS. The raw fills are not merely dim on navy
  // — maroon, dark blue and purple fall under 3:1, the bar for NON-TEXT UI, so
  // the card's 3pt marker would be invisible rather than just low-contrast.
  it("is needed: several raw fills fail even the non-text bar on navy", () => {
    const failing = FILLS.filter(
      (c) => contrast(entityColor(c), DARK_GROUND) < 3
    );
    expect(failing.length).toBeGreaterThan(0);
  });

  // And the on-white ink is the wrong direction entirely: it DARKENS toward the
  // navy ground.
  it("is needed: the on-white ink is darker than the fill it came from", () => {
    const sample = "#2E8B50";
    expect(luminance(entityInk(sample))).toBeLessThan(
      luminance(entityColor(sample))
    );
  });

  // The guarantee the dark card relies on. 4.5:1 is the body-text bar, so one
  // value can serve both the marker and the elapsed digits.
  it("clears 4.5:1 against the navy ground for EVERY palette colour", () => {
    for (const c of FILLS) {
      const ratio = contrast(entityOnDark(c), DARK_GROUND);
      expect(
        ratio,
        `${c} -> ${entityOnDark(c)} is ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("always lifts, never darkens", () => {
    for (const c of FILLS) {
      expect(luminance(entityOnDark(c))).toBeGreaterThan(
        luminance(entityColor(c))
      );
    }
  });

  // Hue has to survive, or a goal stops reading as its own colour — the whole
  // point of carrying a colour to the Lock Screen at all.
  it("keeps the channel ordering, so the hue is recognisable", () => {
    for (const c of FILLS) {
      const [r, g, b] = parse(entityColor(c));
      const [r2, g2, b2] = parse(entityOnDark(c));
      expect(r >= g).toBe(r2 >= g2);
      expect(g >= b).toBe(g2 >= b2);
      expect(r >= b).toBe(r2 >= b2);
    }
  });

  it("falls back rather than throwing on junk", () => {
    for (const bad of [null, undefined, "", "nope", "#12"]) {
      expect(entityOnDark(bad)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
