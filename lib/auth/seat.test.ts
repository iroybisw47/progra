import { describe, expect, it } from "vitest";

import { isWaitlisted } from "@/lib/auth/seat";

describe("isWaitlisted", () => {
  it("treats a seat number as a member", () => {
    expect(isWaitlisted({ seat_no: 1 })).toBe(false);
    expect(isWaitlisted({ seat_no: 250 })).toBe(false);
  });

  it("treats an explicit null seat as waitlisted", () => {
    expect(isWaitlisted({ seat_no: null })).toBe(true);
  });

  // The fail-open case: if the app deploys before the column SQL is run,
  // PostgREST omits the key and every user would otherwise be locked out.
  it("treats a missing column as a member, not as waitlisted", () => {
    expect(isWaitlisted({})).toBe(false);
    expect(isWaitlisted({ seat_no: undefined })).toBe(false);
  });

  it("is false when signed out (no profile)", () => {
    expect(isWaitlisted(null)).toBe(false);
  });
});
