import { describe, expect, it } from "vitest";

import { PALETTE, inkFor, isPaletteFill, normalizeFill } from "@/lib/palette";

describe("PALETTE", () => {
  it("is the eleven canonical colors, maroon first", () => {
    expect(PALETTE).toHaveLength(11);
    expect(PALETTE.map((c) => c.name)).toEqual([
      "Maroon",
      "Red",
      "Orange",
      "Gold",
      "Light green",
      "Green",
      "Light blue",
      "Dark blue",
      "Purple",
      "Dark purple",
      "Pink",
    ]);
    expect(PALETTE[0]).toEqual({
      name: "Maroon",
      fill: "#8E3A44",
      ink: "#6E2530",
    });
  });

  it("never reuses a fill, and gives every color a distinct ink", () => {
    const fills = PALETTE.map((c) => c.fill);
    expect(new Set(fills).size).toBe(11);
    for (const c of PALETTE) expect(c.ink).not.toBe(c.fill);
  });
});

describe("normalizeFill", () => {
  it("passes current fills through, case-insensitively", () => {
    expect(normalizeFill("#2E8B50")).toBe("#2E8B50");
    expect(normalizeFill("#2e8b50")).toBe("#2E8B50");
  });

  it("maps the retired nine-hue palette forward", () => {
    // Brick → Maroon, Blue → Dark blue, Indigo → Dark purple, Plum → Pink.
    expect(normalizeFill("#9C5148")).toBe("#8E3A44");
    expect(normalizeFill("#4A6FA5")).toBe("#395AA0");
    expect(normalizeFill("#6B639C")).toBe("#6F4E93");
    expect(normalizeFill("#91607F")).toBe("#D06DA1");
  });

  it("maps the 12-swatch palette before that", () => {
    expect(normalizeFill("#4f9b8c")).toBe("#2E8B50");
    expect(normalizeFill("#5f87c0")).toBe("#395AA0");
  });

  it("every legacy hue lands on a real palette fill", () => {
    const legacy = [
      "#9c5148", "#b0703c", "#a98a38", "#7d8850", "#4e7a5f", "#46808a",
      "#4a6fa5", "#6b639c", "#91607f", "#c96f5e", "#d08c4a", "#c7a23a",
      "#8fa04f", "#6b9459", "#4f9b8c", "#58a3b4", "#5f87c0", "#7d76c4",
      "#a56fa8", "#c06f8d", "#8d8778",
    ];
    for (const hex of legacy) {
      const fill = normalizeFill(hex);
      expect(fill, hex).not.toBeNull();
      expect(PALETTE.some((c) => c.fill === fill), hex).toBe(true);
    }
  });

  it("returns null for nothing and for off-palette values", () => {
    expect(normalizeFill(null)).toBeNull();
    expect(normalizeFill(undefined)).toBeNull();
    expect(normalizeFill("")).toBeNull();
    expect(normalizeFill("#123456")).toBeNull();
  });
});

describe("isPaletteFill", () => {
  it("accepts only the eleven current fills", () => {
    for (const c of PALETTE) expect(isPaletteFill(c.fill)).toBe(true);
    // Retired hues are normalized on read, so a save never carries one.
    expect(isPaletteFill("#9C5148")).toBe(false);
    expect(isPaletteFill("#123456")).toBe(false);
  });
});

describe("inkFor", () => {
  it("returns the text twin of a fill, including for legacy hues", () => {
    expect(inkFor("#2E8B50")).toBe("#175E33");
    expect(inkFor("#91607F")).toBe("#BA4485"); // old plum → pink's ink
  });

  it("leaves off-palette values alone", () => {
    expect(inkFor("#9fa6b0")).toBe("#9fa6b0");
    expect(inkFor(null)).toBe("");
  });
});
