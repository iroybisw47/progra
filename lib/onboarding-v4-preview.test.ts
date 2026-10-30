import { describe, expect, it } from "vitest";

import { V4_SCREEN } from "@/lib/onboarding-v4";
import { parseV4PreviewParams } from "@/lib/onboarding-v4-preview";

describe("the v4 preview's URL", () => {
  it("opens on a named or numbered step", () => {
    expect(parseV4PreviewParams({ step: "how" }).screen).toBe(V4_SCREEN.how);
    expect(parseV4PreviewParams({ step: "6" }).screen).toBe(V4_SCREEN.post);
    expect(parseV4PreviewParams({ step: "99" }).screen).toBe(V4_SCREEN.notify);
    expect(parseV4PreviewParams({}).screen).toBe(V4_SCREEN.welcome);
  });

  it("takes How's step 1-based, and falls back rather than erroring", () => {
    expect(parseV4PreviewParams({ how: "3" }).howStep).toBe(2);
    expect(parseV4PreviewParams({ how: "x" }).howStep).toBe(0);
    expect(parseV4PreviewParams({ fixture: "nope" }).fixture).toBe("welcome");
  });

  it("opens the UW fixtures on the posted practice post, UW on", () => {
    expect(parseV4PreviewParams({ fixture: "uw-sheet" })).toMatchObject({
      screen: V4_SCREEN.post,
      posted: true,
      uw: true,
    });
    expect(parseV4PreviewParams({ fixture: "goals" }).uw).toBeUndefined();
    expect(parseV4PreviewParams({ uw: "0", fixture: "uw-page" }).uw).toBe(false);
  });

  it("leaves the notifications screen out with notify=0", () => {
    expect(parseV4PreviewParams({}).notify).toBe(true);
    expect(parseV4PreviewParams({ notify: "0" }).notify).toBe(false);
  });
});
