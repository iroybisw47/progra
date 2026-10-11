import { describe, expect, it } from "vitest";

import {
  UW_BUCKETS,
  UW_GROUP_KEY,
  UW_PEER_FETCH,
  UW_PEER_PAGE,
  buildUwPeerGroups,
  compareUwOrder,
  emptyUwPeerGroups,
  emptyUwPeerPage,
  isIsoTimestamp,
  isUwBucket,
  nextUwCursor,
  parseUwCursor,
  uwPeerFromRow,
  uwPeerPage,
  type UwBucket,
  type UwPeerRow,
} from "@/lib/uw-peers";

// A UUID per index, so rows are distinct and valid.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Rows as list_uw_peers returns them: (onboarded_at desc, id desc) within a
// bucket. Microsecond timestamps on purpose, which is what Postgres sends.
function row(n: number, bucket: string, over: Partial<UwPeerRow> = {}): UwPeerRow {
  return {
    id: uuid(n),
    username: `peer${n}`,
    display_name: `Peer ${n}`,
    avatar_path: null,
    bucket,
    matched: bucket === "rest" ? null : "Economics",
    major: bucket === "rest" ? "Economics" : null,
    onboarded_at: `2026-10-01T12:00:${String(59 - (n % 60)).padStart(2, "0")}.123456+00:00`,
    bucket_total: 1,
    ...over,
  };
}

function rows(bucket: UwBucket, count: number, total = count, from = 0): UwPeerRow[] {
  return Array.from({ length: count }, (_, i) =>
    row(from + i, bucket, { bucket_total: total })
  );
}

describe("buckets", () => {
  it("are the SQL's three names, in render order", () => {
    expect(UW_BUCKETS).toEqual(["same_major", "shared_interest", "rest"]);
    expect(UW_GROUP_KEY).toEqual({
      same_major: "sameMajor",
      shared_interest: "sharedInterest",
      rest: "rest",
    });
  });

  it("validate a bucket a client sends back", () => {
    for (const b of UW_BUCKETS) expect(isUwBucket(b)).toBe(true);
    expect(isUwBucket("Rest")).toBe(false);
    expect(isUwBucket("rest ")).toBe(false);
    expect(isUwBucket("all")).toBe(false);
    expect(isUwBucket("")).toBe(false);
    expect(isUwBucket(null)).toBe(false);
    expect(isUwBucket(["rest"])).toBe(false);
  });

  it("page one row past a page, inside the RPC's cap of 50", () => {
    expect(UW_PEER_FETCH).toBe(UW_PEER_PAGE + 1);
    expect(UW_PEER_FETCH).toBeLessThanOrEqual(50);
  });
});

describe("uwPeerFromRow", () => {
  it("maps a match row to its matched string, with no major", () => {
    expect(uwPeerFromRow(row(1, "same_major", { matched: "Economics", major: "Physics" }))).toEqual({
      userId: uuid(1),
      username: "peer1",
      displayName: "Peer 1",
      avatarUrl: null,
      matched: "Economics",
      major: null,
      onboardedAt: "2026-10-01T12:00:58.123456+00:00",
    });
    expect(uwPeerFromRow(row(2, "shared_interest", { matched: "Chess" }))?.matched).toBe("Chess");
  });

  it("keeps the row's onboarded_at verbatim, or null when it isn't a timestamp", () => {
    expect(
      uwPeerFromRow(row(1, "rest", { onboarded_at: "2026-10-01T12:00:00.1+00:00" }))?.onboardedAt
    ).toBe("2026-10-01T12:00:00.1+00:00");
    expect(uwPeerFromRow(row(1, "rest", { onboarded_at: "yesterday" }))?.onboardedAt).toBe(null);
  });

  // Plan D3: free-text majors still match, but are never rendered to
  // strangers. A display filter only: the RPC itself still returns them.
  it("shows a More at UW major only when it is on the list, in its spelling", () => {
    expect(uwPeerFromRow(row(1, "rest", { major: "Economics" }))?.major).toBe("Economics");
    expect(uwPeerFromRow(row(2, "rest", { major: "computer science" }))?.major).toBe(
      "Computer Science"
    );
    expect(uwPeerFromRow(row(3, "rest", { major: "My Secret Self-Designed Major" }))?.major).toBe(
      null
    );
    expect(uwPeerFromRow(row(4, "rest", { major: null }))?.major).toBe(null);
  });

  it("keeps the row when it drops the major", () => {
    const peer = uwPeerFromRow(row(3, "rest", { major: "Underwater Basketry" }));
    expect(peer?.userId).toBe(uuid(3));
    expect(peer?.username).toBe("peer3");
  });

  it("lets the bucket, not the row, decide which subline may be set", () => {
    // A match row that somehow carried a major never shows it, and a rest row
    // never shows a matched string.
    expect(uwPeerFromRow(row(1, "shared_interest", { major: "Economics" }))?.major).toBe(null);
    expect(uwPeerFromRow(row(2, "rest", { matched: "Chess" }))?.matched).toBe(null);
  });

  it("drops a row that isn't one", () => {
    expect(uwPeerFromRow(row(1, "everyone"))).toBe(null);
    expect(uwPeerFromRow(row(1, "rest", { id: "not-a-uuid" }))).toBe(null);
    expect(uwPeerFromRow(row(1, "rest", { username: null }))).toBe(null);
    expect(uwPeerFromRow(row(1, "rest", { username: "  " }))).toBe(null);
  });

  it("treats a blank name or matched string as none", () => {
    const peer = uwPeerFromRow(row(1, "same_major", { display_name: " ", matched: "" }));
    expect(peer?.displayName).toBe(null);
    expect(peer?.matched).toBe(null);
  });
});

describe("isIsoTimestamp", () => {
  it("accepts what PostgREST writes for a timestamptz", () => {
    expect(isIsoTimestamp("2026-10-01T12:00:59.123456+00:00")).toBe(true);
    expect(isIsoTimestamp("2026-10-01T12:00:59+05:30")).toBe(true);
    expect(isIsoTimestamp("2026-10-01T12:00:59.1-07:00")).toBe(true);
    expect(isIsoTimestamp("2026-10-01T12:00:59Z")).toBe(true);
  });

  it("refuses anything else", () => {
    // No offset: Postgres would read it in the session's zone.
    expect(isIsoTimestamp("2026-10-01T12:00:59")).toBe(false);
    expect(isIsoTimestamp("2026-10-01")).toBe(false);
    expect(isIsoTimestamp("2026-10-01T12:00:59.1234567+00:00")).toBe(false);
    expect(isIsoTimestamp("2026-13-01T12:00:59Z")).toBe(false);
    expect(isIsoTimestamp("yesterday")).toBe(false);
    expect(isIsoTimestamp("2026-10-01T12:00:59Z; drop table profiles")).toBe(false);
    expect(isIsoTimestamp(1_790_000_000_000)).toBe(false);
    expect(isIsoTimestamp(null)).toBe(false);
  });
});

describe("parseUwCursor", () => {
  const ts = "2026-10-01T12:00:59.123456+00:00";

  it("accepts a timestamp and a UUID, and keeps the timestamp verbatim", () => {
    const cursor = parseUwCursor({ ts, id: uuid(7) });
    expect(cursor).toEqual({ ts, id: uuid(7) });
    // Microseconds survive: a Date round-trip would cut them to .123.
    expect(cursor?.ts).toContain(".123456");
  });

  it("drops anything extra a client sent", () => {
    expect(parseUwCursor({ ts, id: uuid(7), bucket: "rest" })).toEqual({ ts, id: uuid(7) });
  });

  it("refuses a malformed cursor", () => {
    expect(parseUwCursor(null)).toBe(null);
    expect(parseUwCursor("cursor")).toBe(null);
    expect(parseUwCursor({ ts })).toBe(null);
    expect(parseUwCursor({ id: uuid(7) })).toBe(null);
    expect(parseUwCursor({ ts: "soon", id: uuid(7) })).toBe(null);
    expect(parseUwCursor({ ts, id: "7" })).toBe(null);
    expect(parseUwCursor({ ts, id: `${uuid(7)},rest` })).toBe(null);
  });
});

describe("nextUwCursor", () => {
  it("is null while the extra row didn't come back", () => {
    expect(nextUwCursor([])).toBe(null);
    expect(nextUwCursor(rows("rest", UW_PEER_PAGE - 1))).toBe(null);
    // Exactly a page: there is no next one, and no empty fetch to learn that.
    expect(nextUwCursor(rows("rest", UW_PEER_PAGE))).toBe(null);
  });

  it("starts after the last row SHOWN, so the extra row leads the next page", () => {
    const page = rows("rest", UW_PEER_FETCH);
    const last = page[UW_PEER_PAGE - 1];
    expect(nextUwCursor(page)).toEqual({ ts: last.onboarded_at, id: last.id });
  });

  it("stops rather than guess when the last row's key is unusable", () => {
    const page = rows("rest", UW_PEER_FETCH);
    page[UW_PEER_PAGE - 1] = { ...page[UW_PEER_PAGE - 1], onboarded_at: "never" };
    expect(nextUwCursor(page)).toBe(null);
  });
});

describe("uwPeerPage", () => {
  it("shows a page, takes the total from the rows, and hands on a cursor", () => {
    const page = uwPeerPage(rows("rest", UW_PEER_FETCH, 57), "rest");
    expect(page.peers).toHaveLength(UW_PEER_PAGE);
    expect(page.total).toBe(57);
    expect(page.cursor?.id).toBe(uuid(UW_PEER_PAGE - 1));
  });

  it("reads a bigint total that arrives as a string", () => {
    expect(uwPeerPage(rows("rest", 3, 3).map((r) => ({ ...r, bucket_total: "3" })), "rest").total).toBe(3);
  });

  it("never reports fewer than it shows", () => {
    expect(uwPeerPage(rows("rest", 3, 0), "rest").total).toBe(3);
    expect(uwPeerPage(rows("rest", 3).map((r) => ({ ...r, bucket_total: "lots" })), "rest").total).toBe(3);
  });

  it("is empty for a bucket with no rows, with no count rather than a 0", () => {
    expect(uwPeerPage(rows("rest", 4), "same_major")).toEqual({ peers: [], total: null, cursor: null });
  });

  // The look-ahead row behind the cursor can be friended, blocked or unlisted
  // before the next fetch. The rows already on screen are still there, so the
  // page must not claim the group has shrunk to nothing.
  it("reports no count for an empty follow-up page, so the header keeps its own", () => {
    expect(uwPeerPage([], "rest")).toEqual({ peers: [], total: null, cursor: null });
    expect(uwPeerPage([], "rest")).toEqual(emptyUwPeerPage());
  });

  it("keeps the cursor where it was when a shown row is dropped as malformed", () => {
    const raw = rows("rest", UW_PEER_FETCH, 40);
    raw[3] = { ...raw[3], username: null };
    const page = uwPeerPage(raw, "rest");
    expect(page.peers).toHaveLength(UW_PEER_PAGE - 1);
    expect(page.cursor?.id).toBe(uuid(UW_PEER_PAGE - 1));
  });
});

describe("buildUwPeerGroups", () => {
  it("splits an every-bucket result into the three groups", () => {
    const groups = buildUwPeerGroups([
      ...rows("same_major", 2, 2, 0),
      ...rows("shared_interest", 1, 1, 10),
      ...rows("rest", UW_PEER_FETCH, 33, 100),
    ]);
    expect(groups.sameMajor.map((p) => p.userId)).toEqual([uuid(0), uuid(1)]);
    expect(groups.sharedInterest.map((p) => p.userId)).toEqual([uuid(10)]);
    expect(groups.rest).toHaveLength(UW_PEER_PAGE);
    expect(groups.totals).toEqual({ sameMajor: 2, sharedInterest: 1, rest: 33 });
    expect(groups.cursors.sameMajor).toBe(null);
    expect(groups.cursors.sharedInterest).toBe(null);
    expect(groups.cursors.rest?.id).toBe(uuid(100 + UW_PEER_PAGE - 1));
  });

  it("pages each bucket on its own", () => {
    const groups = buildUwPeerGroups([
      ...rows("same_major", UW_PEER_FETCH, 25, 0),
      ...rows("rest", 2, 2, 100),
    ]);
    expect(groups.cursors.sameMajor?.id).toBe(uuid(UW_PEER_PAGE - 1));
    expect(groups.cursors.rest).toBe(null);
    expect(groups.sameMajor).toHaveLength(UW_PEER_PAGE);
  });

  it("applies the off-list major filter to More at UW", () => {
    const groups = buildUwPeerGroups([
      row(1, "rest", { major: "Psychology" }),
      row(2, "rest", { major: "Comparative History of Ideas" }),
    ]);
    expect(groups.rest.map((p) => p.major)).toEqual(["Psychology", null]);
  });

  it("ignores a row from an unknown bucket", () => {
    const groups = buildUwPeerGroups([row(1, "friends"), row(2, "rest")]);
    expect(groups.rest.map((p) => p.userId)).toEqual([uuid(2)]);
    expect(groups.sameMajor).toEqual([]);
    expect(groups.sharedInterest).toEqual([]);
  });

  it("is the empty answer for no rows", () => {
    expect(buildUwPeerGroups([])).toEqual(emptyUwPeerGroups());
  });

  it("counts a bucket the first call returned no rows for as 0, not unknown", () => {
    const groups = buildUwPeerGroups(rows("rest", 2));
    expect(groups.totals).toEqual({ sameMajor: 0, sharedInterest: 0, rest: 2 });
  });

  it("hands out a fresh empty answer each time", () => {
    const a = emptyUwPeerGroups();
    a.rest.push({
      userId: uuid(1),
      username: "x",
      displayName: null,
      avatarUrl: null,
      matched: null,
      major: null,
      onboardedAt: null,
    });
    expect(emptyUwPeerGroups().rest).toEqual([]);
  });
});

describe("compareUwOrder", () => {
  const at = (ts: string, n = 1) => ({ ts, id: uuid(n) });

  it("puts the newer first, to the microsecond, however Postgres trimmed it", () => {
    expect(compareUwOrder(at("2026-10-01T12:00:05.123457+00:00"), at("2026-10-01T12:00:05.123456+00:00"))).toBeLessThan(0);
    // "05.1234" is 05.123400, before (older than) 05.123456: a string compare
    // would get this backwards.
    expect(compareUwOrder(at("2026-10-01T12:00:05.1234+00:00"), at("2026-10-01T12:00:05.123456+00:00"))).toBeGreaterThan(0);
    expect(compareUwOrder(at("2026-10-01T12:00:05+00:00"), at("2026-10-01T12:00:05.000001+00:00"))).toBeGreaterThan(0);
  });

  it("reads the offset", () => {
    expect(compareUwOrder(at("2026-10-01T12:00:05+00:00"), at("2026-10-01T05:00:05-07:00"))).toBe(0);
    expect(compareUwOrder(at("2026-10-01T17:30:05+0530"), at("2026-10-01T12:00:05Z"))).toBe(0);
    expect(compareUwOrder(at("2026-10-01T13:00:00+01"), at("2026-10-01T12:00:00.5Z"))).toBeGreaterThan(0);
  });

  it("breaks a tie on the id, higher first, as the RPC does", () => {
    const ts = "2026-10-01T12:00:05.123456+00:00";
    expect(compareUwOrder(at(ts, 2), at(ts, 1))).toBeLessThan(0);
    expect(compareUwOrder(at(ts, 1), at(ts, 2))).toBeGreaterThan(0);
    expect(compareUwOrder(at(ts, 1), { ts, id: uuid(1).toUpperCase() })).toBe(0);
  });

  it("is null when a timestamp can't be read", () => {
    expect(compareUwOrder(at("soon"), at("2026-10-01T12:00:05Z"))).toBeNull();
  });
});
