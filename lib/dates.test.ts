import { describe, expect, it } from "vitest";

import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "@/lib/dates";

describe("month boundaries", () => {
  it("startOfMonth is the 1st at 00:00:00.000 local", () => {
    const s = startOfMonth(new Date(2026, 5, 23, 14, 30, 45, 500)); // Jun 23 2026
    expect([
      s.getFullYear(),
      s.getMonth(),
      s.getDate(),
      s.getHours(),
      s.getMinutes(),
      s.getSeconds(),
      s.getMilliseconds(),
    ]).toEqual([2026, 5, 1, 0, 0, 0, 0]);
  });

  it("endOfMonth is the last day at 23:59:59.999", () => {
    const e = endOfMonth(new Date(2026, 5, 23));
    expect([e.getMonth(), e.getDate(), e.getHours(), e.getMilliseconds()]).toEqual(
      [5, 30, 23, 999] // June has 30 days
    );
  });

  it("handles February in leap and non-leap years", () => {
    expect(endOfMonth(new Date(2024, 1, 10)).getDate()).toBe(29); // 2024 leap
    expect(endOfMonth(new Date(2026, 1, 10)).getDate()).toBe(28); // 2026 not
  });
});

describe("year boundaries", () => {
  it("spans Jan 1 00:00 .. Dec 31 23:59:59.999", () => {
    const anchor = new Date(2026, 6, 15);
    const s = startOfYear(anchor);
    const e = endOfYear(anchor);
    expect([s.getMonth(), s.getDate(), s.getHours()]).toEqual([0, 1, 0]);
    expect([e.getMonth(), e.getDate(), e.getMilliseconds()]).toEqual([11, 31, 999]);
  });
});

describe("week boundaries (Monday-first)", () => {
  // 2026-06-24 is a Wednesday.
  it("startOfWeek is the preceding Monday at 00:00", () => {
    const s = startOfWeek(new Date(2026, 5, 24, 9, 15));
    expect([s.getDay(), s.getDate(), s.getHours()]).toEqual([1, 22, 0]);
  });

  it("endOfWeek is the following Sunday at 23:59:59.999", () => {
    const e = endOfWeek(new Date(2026, 5, 24));
    expect([e.getDay(), e.getDate(), e.getMilliseconds()]).toEqual([0, 28, 999]);
  });
});
