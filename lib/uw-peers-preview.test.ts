import { describe, expect, it } from "vitest";

import { checkUsername } from "@/lib/social/username";
import { isUuid } from "@/lib/validate";
import { UW_PEER_PAGE, isIsoTimestamp } from "@/lib/uw-peers";
import {
  PREVIEW_UW_CALLER,
  PREVIEW_UW_COHORT,
  fakeListUwPeers,
  fakeUwPeerGroups,
  fakeUwPeerPage,
} from "@/lib/uw-peers-preview";

describe("the made-up cohort", () => {
  it("has handles, ids and timestamps the real shaping accepts", () => {
    for (const s of PREVIEW_UW_COHORT) {
      expect(checkUsername(s.username).ok).toBe(true);
      expect(isUuid(s.id)).toBe(true);
      expect(isIsoTimestamp(s.onboardedAt)).toBe(true);
    }
    expect(new Set(PREVIEW_UW_COHORT.map((s) => s.username)).size).toBe(PREVIEW_UW_COHORT.length);
    expect(new Set(PREVIEW_UW_COHORT.map((s) => s.id)).size).toBe(PREVIEW_UW_COHORT.length);
  });
});

describe("fakeListUwPeers, by the RPC's rules", () => {
  const rows = fakeListUwPeers(PREVIEW_UW_COHORT, PREVIEW_UW_CALLER, { limit: 50 });

  it("puts each peer in one bucket, majors before interests", () => {
    const by = (b: string) => rows.filter((r) => r.bucket === b).map((r) => r.username);
    expect(by("same_major")).toEqual(["aisha_r", "tomasreyes", "graceliu", "owenpark"]);
    expect(by("shared_interest")).toEqual(["jordanblake", "meitanaka", "samokafor"]);
    expect(by("rest")).toHaveLength(PREVIEW_UW_COHORT.length - 7);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("returns the caller's own string as matched, and a major for rest only", () => {
    const owen = rows.find((r) => r.username === "owenpark");
    expect(owen?.matched).toBe("Computer Science");
    const mei = rows.find((r) => r.username === "meitanaka");
    expect(mei?.matched).toBe("Running");
    expect(rows.filter((r) => r.bucket !== "rest").every((r) => r.major === null)).toBe(true);
    expect(rows.filter((r) => r.bucket === "rest").every((r) => r.matched === null)).toBe(true);
  });

  it("leaves out anyone excluded (a friendship row, a block)", () => {
    const aisha = PREVIEW_UW_COHORT[0].id;
    const less = fakeListUwPeers(PREVIEW_UW_COHORT, PREVIEW_UW_CALLER, {
      limit: 50,
      exclude: new Set([aisha]),
    });
    expect(less.some((r) => r.id === aisha)).toBe(false);
    expect(less.find((r) => r.bucket === "same_major")?.bucket_total).toBe(3);
  });
});

describe("the fake groups and pages", () => {
  it("give a first page of each group and a cursor for More at UW", () => {
    const g = fakeUwPeerGroups(PREVIEW_UW_COHORT, PREVIEW_UW_CALLER);
    expect(g.sameMajor).toHaveLength(4);
    expect(g.sharedInterest).toHaveLength(3);
    expect(g.rest).toHaveLength(UW_PEER_PAGE);
    expect(g.totals.rest).toBe(PREVIEW_UW_COHORT.length - 7);
    expect(g.cursors.rest).not.toBeNull();
    expect(g.cursors.sameMajor).toBeNull();
    // The off-list major filter ran: Chloe typed hers, Caleb gave none.
    const chloe = g.rest.find((p) => p.username === "chloedubois");
    expect(chloe?.major).toBeNull();
  });

  it("page More at UW on from the cursor, without repeating a row", () => {
    const g = fakeUwPeerGroups(PREVIEW_UW_COHORT, PREVIEW_UW_CALLER);
    const page = fakeUwPeerPage(PREVIEW_UW_COHORT, PREVIEW_UW_CALLER, "rest", g.cursors.rest!);
    expect(page.peers).toHaveLength(g.totals.rest - UW_PEER_PAGE);
    expect(page.cursor).toBeNull();
    const first = new Set(g.rest.map((p) => p.userId));
    expect(page.peers.some((p) => first.has(p.userId))).toBe(false);
  });

  it("are empty for an empty cohort", () => {
    const g = fakeUwPeerGroups([], PREVIEW_UW_CALLER);
    expect([g.sameMajor, g.sharedInterest, g.rest].every((l) => l.length === 0)).toBe(true);
  });
});
