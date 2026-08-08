import { describe, expect, it } from "vitest";

import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  clampDurationMinutes,
  stepDurationDown,
  stepDurationUp,
} from "@/lib/duration";

describe("duration stepper", () => {
  it("steps between round numbers from a round number", () => {
    expect(stepDurationUp(60)).toBe(70);
    expect(stepDurationDown(60)).toBe(50);
  });

  // The point of snapping rather than adding 10: a typed value is honoured
  // exactly, but stepping from it returns you to round numbers instead of
  // stranding you on 57 / 67 with no way back except retyping.
  it("snaps to the next/previous ten from an off-step value", () => {
    expect(stepDurationUp(47)).toBe(50);
    expect(stepDurationDown(47)).toBe(40);
    expect(stepDurationUp(41)).toBe(50);
    expect(stepDurationDown(49)).toBe(40);
  });

  it("holds at the bounds instead of running past them", () => {
    expect(stepDurationDown(MIN_DURATION_MINUTES)).toBe(MIN_DURATION_MINUTES);
    expect(stepDurationUp(MAX_DURATION_MINUTES)).toBe(MAX_DURATION_MINUTES);
    // From just inside the ceiling, the step is truncated rather than skipped.
    expect(stepDurationUp(595)).toBe(MAX_DURATION_MINUTES);
  });
});

describe("clampDurationMinutes", () => {
  it("keeps values inside the bounds", () => {
    expect(clampDurationMinutes(47)).toBe(47);
    expect(clampDurationMinutes(0)).toBe(MIN_DURATION_MINUTES);
    expect(clampDurationMinutes(-30)).toBe(MIN_DURATION_MINUTES);
    expect(clampDurationMinutes(9999)).toBe(MAX_DURATION_MINUTES);
  });

  it("rounds fractions and survives garbage", () => {
    expect(clampDurationMinutes(47.4)).toBe(47);
    expect(clampDurationMinutes(47.6)).toBe(48);
    // A cleared or unparseable input reaches this as NaN; it must not escape
    // as NaN into the plan, or the clock-in row gets a null-ish target.
    expect(clampDurationMinutes(Number.NaN)).toBe(MIN_DURATION_MINUTES);
    expect(clampDurationMinutes(Number.POSITIVE_INFINITY)).toBe(
      MIN_DURATION_MINUTES
    );
  });
});
