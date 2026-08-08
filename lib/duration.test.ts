import { describe, expect, it } from "vitest";

import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  clampDurationMinutes,
  splitHoursMinutes,
  totalMinutesFrom,
} from "@/lib/duration";

describe("splitHoursMinutes / totalMinutesFrom", () => {
  it("round-trips a total through the two fields", () => {
    expect(splitHoursMinutes(90)).toEqual({ h: 1, m: 30 });
    expect(splitHoursMinutes(45)).toEqual({ h: 0, m: 45 });
    expect(splitHoursMinutes(120)).toEqual({ h: 2, m: 0 });
    expect(totalMinutesFrom("1", "30")).toBe(90);
  });

  // The whole point of two fields: neither has to be filled in. 0 hours means
  // "just minutes"; 0 minutes means "just hours".
  it("treats zero or blank in one field as only the other", () => {
    expect(totalMinutesFrom("0", "45")).toBe(45);
    expect(totalMinutesFrom("", "45")).toBe(45);
    expect(totalMinutesFrom("2", "0")).toBe(120);
    expect(totalMinutesFrom("2", "")).toBe(120);
  });

  // Typing 90 in the minutes box is shorthand, not an error.
  it("rolls minutes over 59 into hours", () => {
    expect(totalMinutesFrom("1", "90")).toBe(150);
    expect(totalMinutesFrom("0", "90")).toBe(90);
  });

  it("returns null only when there's nothing usable, so the caller can revert", () => {
    expect(totalMinutesFrom("", "")).toBe(null);
    expect(totalMinutesFrom("abc", "")).toBe(null);
    // A real zero total is a value, not nothing — it clamps to the floor.
    expect(totalMinutesFrom("0", "0")).toBe(MIN_DURATION_MINUTES);
  });

  it("clamps the combined total to the session bounds", () => {
    expect(totalMinutesFrom("99", "0")).toBe(MAX_DURATION_MINUTES);
    expect(totalMinutesFrom("0", "3")).toBe(MIN_DURATION_MINUTES);
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
