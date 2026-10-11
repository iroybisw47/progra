import { describe, expect, it } from "vitest";

import {
  KEYBOARD_CTA_GAP_PX,
  ctaLift,
  isImeKeyDown,
  keyboardInset,
  overlapPx,
  readViewportMetrics,
} from "@/lib/keyboard";

// iPhone 15-ish numbers: an 852pt layout viewport and a ~336pt keyboard.
describe("keyboardInset", () => {
  it("is 0 with no keyboard", () => {
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 852, visualOffsetTop: 0, scale: 1 })).toBe(0);
  });

  it("is the strip the keyboard covers", () => {
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 516, visualOffsetTop: 0, scale: 1 })).toBe(336);
  });

  it("subtracts how far iOS has panned the visual viewport down", () => {
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 516, visualOffsetTop: 120, scale: 1 })).toBe(216);
  });

  it("is 0 where the layout viewport resizes instead (Android Chrome)", () => {
    expect(keyboardInset({ layoutHeight: 516, visualHeight: 516, visualOffsetTop: 0, scale: 1 })).toBe(0);
  });

  it("never goes negative during an overscroll bounce", () => {
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 852, visualOffsetTop: 14, scale: 1 })).toBe(0);
  });

  it("is 0 on a pinch-zoomed page, where the visual viewport shrinks with no keyboard (iOS Safari)", () => {
    // Zoomed 2x: Safari reports half the height, which would read as a 426px keyboard.
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 426, visualOffsetTop: 0, scale: 2 })).toBe(0);
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 300, visualOffsetTop: 100, scale: 1.4 })).toBe(0);
    // Float noise around 1 still counts as unzoomed.
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 516, visualOffsetTop: 0, scale: 1.000001 })).toBe(336);
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 516, visualOffsetTop: 0, scale: Number.NaN })).toBe(0);
  });

  it("rounds to whole px, and reads garbage as no keyboard", () => {
    expect(keyboardInset({ layoutHeight: 852, visualHeight: 515.6, visualOffsetTop: 0, scale: 1 })).toBe(336);
    expect(keyboardInset({ layoutHeight: Number.NaN, visualHeight: 500, visualOffsetTop: 0, scale: 1 })).toBe(0);
  });
});

describe("readViewportMetrics", () => {
  it("reads the layout and visual viewports", () => {
    expect(
      readViewportMetrics({ innerHeight: 852, visualViewport: { height: 516, offsetTop: 4, scale: 1.5 } })
    ).toEqual({ layoutHeight: 852, visualHeight: 516, visualOffsetTop: 4, scale: 1.5 });
  });

  it("reads a missing scale as unzoomed", () => {
    expect(
      readViewportMetrics({ innerHeight: 852, visualViewport: { height: 516, offsetTop: 4 } })
    ).toEqual({ layoutHeight: 852, visualHeight: 516, visualOffsetTop: 4, scale: 1 });
  });

  it("is null without VisualViewport", () => {
    expect(readViewportMetrics({ innerHeight: 852 })).toBeNull();
    expect(readViewportMetrics({ innerHeight: 852, visualViewport: null })).toBeNull();
  });
});

describe("KEYBOARD_CTA_GAP_PX", () => {
  it("rests the CTA about 12px above the keyboard (R:38)", () => {
    expect(KEYBOARD_CTA_GAP_PX).toBe(12);
  });
});

describe("ctaLift", () => {
  it("rests the CTA 12px above the keyboard, and doesn't move for a keyboard below its spot", () => {
    // The 852 frame with a 34px home indicator: the CTA rests 42px up.
    expect(ctaLift(336, 42)).toBe(306);
    // An iPhone SE: no indicator, so it rests 20px up.
    expect(ctaLift(260, 20)).toBe(252);
    expect(ctaLift(0, 42)).toBe(0);
    expect(ctaLift(20, 42)).toBe(0);
  });

  it("reads garbage as no lift", () => {
    expect(ctaLift(Number.NaN, 42)).toBe(0);
    expect(ctaLift(336, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("overlapPx", () => {
  it("is how far a bottom edge runs past a top edge, gap included", () => {
    // Screen 2 on an SE with two goals: the field ends at 372, the lifted CTA starts at 343.
    expect(overlapPx(372, 343, 8)).toBe(37);
    expect(overlapPx(300, 343, 8)).toBe(0);
    expect(overlapPx(335, 343, 8)).toBe(0);
    expect(overlapPx(335.2, 343, 8)).toBe(1);
  });

  it("reads garbage as clear", () => {
    expect(overlapPx(Number.NaN, 343)).toBe(0);
  });
});

describe("isImeKeyDown", () => {
  it("catches WebKit's conversion-confirming Return as well as one mid-composition", () => {
    expect(isImeKeyDown({ isComposing: true, keyCode: 13 })).toBe(true);
    expect(isImeKeyDown({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isImeKeyDown({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isImeKeyDown({})).toBe(false);
  });
});
