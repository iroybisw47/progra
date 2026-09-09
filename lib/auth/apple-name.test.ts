import { describe, expect, it } from "vitest";

import { appleDisplayName } from "./apple-name";

describe("appleDisplayName", () => {
  it("joins both halves", () => {
    expect(appleDisplayName("Ada", "Lovelace")).toBe("Ada Lovelace");
  });

  it("keeps a lone given name", () => {
    expect(appleDisplayName("Ada", null)).toBe("Ada");
  });

  it("keeps a lone family name", () => {
    expect(appleDisplayName(null, "Lovelace")).toBe("Lovelace");
  });

  // The every-sign-in-after-the-first case, and the reason the caller must not
  // overwrite an existing display_name.
  it("is undefined when Apple sends nothing", () => {
    expect(appleDisplayName(null, null)).toBeUndefined();
    expect(appleDisplayName(undefined, undefined)).toBeUndefined();
  });

  it("treats whitespace-only halves as absent", () => {
    expect(appleDisplayName("  ", "\t")).toBeUndefined();
    expect(appleDisplayName("  ", "Lovelace")).toBe("Lovelace");
  });

  it("trims, so a padded half never doubles the separator", () => {
    expect(appleDisplayName(" Ada ", " Lovelace ")).toBe("Ada Lovelace");
  });
});
