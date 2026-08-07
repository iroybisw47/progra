import { describe, expect, it } from "vitest";

import {
  MAX_ACTIVE_HABITS,
  canAddHabit,
  shouldPostCheckoffToFeed,
} from "@/lib/habits";

describe("canAddHabit", () => {
  it("allows adding below the cap", () => {
    expect(canAddHabit(0)).toBe(true);
    expect(canAddHabit(MAX_ACTIVE_HABITS - 1)).toBe(true);
  });

  it("rejects the one that would exceed the cap", () => {
    expect(canAddHabit(MAX_ACTIVE_HABITS)).toBe(false);
  });

  // An account that somehow sits above the cap (a raised-then-lowered limit,
  // or rows created before it existed) must still be blocked from adding more
  // rather than wrapping around to allowed.
  it("stays closed above the cap", () => {
    expect(canAddHabit(MAX_ACTIVE_HABITS + 5)).toBe(false);
  });

  // The caller counts only non-archived habits, which is the whole mechanism
  // by which archiving frees a slot — this pins the boundary that relies on it.
  it("re-opens as soon as the active count drops back under", () => {
    expect(canAddHabit(MAX_ACTIVE_HABITS)).toBe(false);
    expect(canAddHabit(MAX_ACTIVE_HABITS - 1)).toBe(true);
  });
});

describe("shouldPostCheckoffToFeed", () => {
  it("posts a check-off made on the day it's for", () => {
    expect(shouldPostCheckoffToFeed("2026-08-06", "2026-08-06")).toBe(true);
  });

  it("does not post a backfilled day", () => {
    expect(shouldPostCheckoffToFeed("2026-08-05", "2026-08-06")).toBe(false);
    expect(shouldPostCheckoffToFeed("2026-07-30", "2026-08-06")).toBe(false);
  });

  // Month and year boundaries are where a naive "is it yesterday?" check would
  // break; a string compare doesn't care, and this says so out loud.
  it("handles month and year rollovers", () => {
    expect(shouldPostCheckoffToFeed("2026-07-31", "2026-08-01")).toBe(false);
    expect(shouldPostCheckoffToFeed("2025-12-31", "2026-01-01")).toBe(false);
    expect(shouldPostCheckoffToFeed("2026-01-01", "2026-01-01")).toBe(true);
  });

  // The action rejects future dates before reaching this, but if that guard
  // ever moved, a future check-off must not post either.
  it("does not post a future day", () => {
    expect(shouldPostCheckoffToFeed("2026-08-07", "2026-08-06")).toBe(false);
  });
});
