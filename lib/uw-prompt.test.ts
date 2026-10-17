import { describe, expect, it } from "vitest";

import {
  isUwPromptStamp,
  uwPromptFor,
  type UwPromptProfile,
} from "@/lib/uw-prompt";

const base: UwPromptProfile = {
  onboarded_at: "2026-09-01T00:00:00Z",
  uw_prompt: null,
  is_uw: false,
};

describe("uwPromptFor", () => {
  it("opens the sheet and shows the card for a member never asked", () => {
    expect(uwPromptFor(base, true)).toEqual({ sheet: true, card: true });
  });

  it("keeps only the card after Not now", () => {
    expect(uwPromptFor({ ...base, uw_prompt: "later" }, true)).toEqual({
      sheet: false,
      card: true,
    });
  });

  it("shows nothing once done", () => {
    expect(uwPromptFor({ ...base, uw_prompt: "done" }, true)).toEqual({
      sheet: false,
      card: false,
    });
  });

  it("shows nothing with UW off", () => {
    expect(uwPromptFor(base, false)).toEqual({ sheet: false, card: false });
  });

  it("fails closed before the column exists", () => {
    const { uw_prompt: _omit, ...noColumn } = base;
    void _omit;
    expect(uwPromptFor(noColumn, true)).toEqual({ sheet: false, card: false });
  });

  it("never interrupts onboarding", () => {
    expect(uwPromptFor({ ...base, onboarded_at: null }, true)).toEqual({
      sheet: false,
      card: false,
    });
  });

  it("shows nothing without a profile", () => {
    expect(uwPromptFor(null, true)).toEqual({ sheet: false, card: false });
  });

  it("never asks a registered UW student, filled in or not, stamped or not", () => {
    for (const uw_prompt of [null, "later"]) {
      expect(uwPromptFor({ ...base, is_uw: true, uw_prompt }, true)).toEqual({
        sheet: false,
        card: false,
      });
    }
  });

  it("treats an unknown stamp as answered", () => {
    expect(uwPromptFor({ ...base, uw_prompt: "something" }, true)).toEqual({
      sheet: false,
      card: false,
    });
  });
});

describe("isUwPromptStamp", () => {
  it("admits only the two writable stamps", () => {
    expect(isUwPromptStamp("later")).toBe(true);
    expect(isUwPromptStamp("done")).toBe(true);
    for (const v of [null, undefined, "", "Later", "yes", 1])
      expect(isUwPromptStamp(v)).toBe(false);
  });
});
