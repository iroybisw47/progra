// Onboarding v3's UW groups (plan D2, D3; §4.2 STEP 5): the rows
// list_uw_peers returns, turned into the three groups Screen 5 and the Friends
// tab render (P9d) — "In {major}", "Shares your interests", "More at UW" — and
// the keyset cursor each group pages with.
//
// Pure: no React, server or network code, so lib/uw-peers.test.ts pins the
// rules that are easy to get quietly wrong (the off-list major filter, the
// cursor, the bucket split). lib/db/uw.ts runs the RPC and hands its rows here;
// app/actions/uw.ts validates what a client sends back.
//
// THE CONTRACT, as uw-cohort.sql STEP 5 defines it:
//   list_uw_peers(p_bucket, p_limit, p_after_ts, p_after_id) returns
//   (id, username, display_name, avatar_path, bucket, matched, major,
//    onboarded_at, bucket_total).
//   - A null bucket returns the first page of EVERY bucket; a bucket name
//     returns that bucket alone, after the cursor when one is given. The
//     cursor is honoured only together with a bucket.
//   - Each bucket is ordered (onboarded_at desc, id desc) and paged on its
//     own, so a page of one never skips or repeats a row of another.
//   - `matched` is the CALLER's own major or interest that matched, never the
//     peer's: "Also studying {matched}" repeats what the viewer typed.
//   - `major` is set only for 'rest', and is the peer's first major.
//   - `bucket_total` is the whole bucket's size, whatever the cursor.
// Who appears at all (UW, listed, seated caller, no block, no friendship row
// either way) is decided in SQL. Nothing here widens or narrows that.

import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { listedMajor } from "@/lib/uw";
import { isUuid } from "@/lib/validate";

// The SQL's bucket names, in the order the groups render.
export const UW_BUCKETS = ["same_major", "shared_interest", "rest"] as const;
export type UwBucket = (typeof UW_BUCKETS)[number];

export function isUwBucket(value: unknown): value is UwBucket {
  return typeof value === "string" && (UW_BUCKETS as readonly string[]).includes(value);
}

// Each bucket's key in UwPeerGroups.
export const UW_GROUP_KEY = {
  same_major: "sameMajor",
  shared_interest: "sharedInterest",
  rest: "rest",
} as const satisfies Record<UwBucket, string>;
export type UwGroupKey = (typeof UW_GROUP_KEY)[UwBucket];

// One page of one group: the RPC's own default, and well inside its 50 cap.
export const UW_PEER_PAGE = 20;

// What lib/db/uw.ts asks the RPC for: one row more than a page, per bucket.
// The extra row is never shown; it is how a page knows there is a next one
// without a second call, and without trusting bucket_total to still be right
// by the time the student scrolls (people join and leave the cohort).
export const UW_PEER_FETCH = UW_PEER_PAGE + 1;

// One row of list_uw_peers, as PostgREST returns it. `bucket_total` is a
// bigint, which arrives as a number today but is typed as either so a string
// can't silently become NaN.
export type UwPeerRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  bucket: string;
  matched: string | null;
  major: string | null;
  onboarded_at: string;
  bucket_total: number | string;
};

// One person in a group: the public identity every list in the app shows, plus
// the one line under the name.
export type UwGroupPeer = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  // In a match group, the viewer's own major or interest that matched, for
  // "Also studying {matched}" / "Also into {matched}" (R:137-138). Null in
  // "More at UW".
  matched: string | null;
  // "More at UW" only, and only a major on the known list (plan D3), in the
  // list's spelling. Null when the peer gave none, or typed their own.
  major: string | null;
  // The row's onboarded_at, verbatim, which with userId is its place in the
  // group's order (the cursor's sort key). The Friends tab needs it to tell a
  // paged-in row its fresh first page dropped from one that page pushed down
  // (lib/uw-groups.ts, uwGroupPeers). Null when the row's value isn't a
  // timestamp. Not new to the client: list_uw_peers returns it to any caller,
  // and every cursor already carries one.
  onboardedAt: string | null;
};

// Where the next page of a group starts: the last shown row's sort key. The
// timestamp is passed back VERBATIM, never through a Date. Postgres keeps
// microseconds and a Date keeps milliseconds, so a cursor rounded to the
// millisecond would skip every row onboarded in the rounded-off fraction.
export type UwPeerCursor = { ts: string; id: string };

export type UwPeerPage = {
  peers: UwGroupPeer[];
  // The whole group's size, for the header's count (R:136). Null when the page
  // came back with no rows, because then the RPC sent no count: a follow-up
  // page can be empty even though rows are already on screen (the look-ahead
  // row that made the cursor was friended, blocked or unlisted in between), so
  // the caller keeps the count it had rather than drop the header to 0.
  total: number | null;
  // Null when this page is the last.
  cursor: UwPeerCursor | null;
};

export type UwPeerGroups = {
  sameMajor: UwGroupPeer[];
  sharedInterest: UwGroupPeer[];
  rest: UwGroupPeer[];
  totals: Record<UwGroupKey, number>;
  cursors: Record<UwGroupKey, UwPeerCursor | null>;
};

export function emptyUwPeerPage(): UwPeerPage {
  return { peers: [], total: null, cursor: null };
}

export function emptyUwPeerGroups(): UwPeerGroups {
  return {
    sameMajor: [],
    sharedInterest: [],
    rest: [],
    totals: { sameMajor: 0, sharedInterest: 0, rest: 0 },
    cursors: { sameMajor: null, sharedInterest: null, rest: null },
  };
}

// An ISO 8601 timestamp with an explicit offset, as PostgREST writes a
// timestamptz ("2026-10-01T17:04:05.123456+00:00"), and one Date can read.
// The offset is required: without it Postgres would read the value in the
// session's time zone, and the cursor would land somewhere else.
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2}){0,2})$/;

export function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_TIMESTAMP_RE.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

// The same timestamp in parts, to compare to the microsecond: whole UTC
// seconds and the fraction in microseconds. Never a string compare, since
// Postgres trims trailing zeros ("05.1234" and "05.123456") and drops a zero
// fraction outright, and never one Date, which keeps milliseconds only.
const TS_PARTS_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|([+-])(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?)$/;

function timestampParts(ts: string): [number, number] | null {
  const m = TS_PARTS_RE.exec(ts);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac, sign, oh, om, os] = m;
  const local = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) / 1000;
  const offset = sign ? (sign === "-" ? -1 : 1) * (+oh * 3600 + +(om ?? 0) * 60 + +(os ?? 0)) : 0;
  const seconds = local - offset;
  if (!Number.isFinite(seconds)) return null;
  return [seconds, frac ? +frac.padEnd(6, "0") : 0];
}

// Where `a` sorts against `b` in a group's order, (onboarded_at desc, id
// desc), the order list_uw_peers pages in: negative when `a` comes first,
// positive when after, 0 for the same place. Ids compare as Postgres orders a
// uuid, which for the lowercase hex PostgREST writes is the string order.
// Null when either timestamp can't be read.
export function compareUwOrder(a: UwPeerCursor, b: UwPeerCursor): number | null {
  const ta = timestampParts(a.ts);
  const tb = timestampParts(b.ts);
  if (!ta || !tb) return null;
  if (ta[0] !== tb[0]) return tb[0] - ta[0];
  if (ta[1] !== tb[1]) return tb[1] - ta[1];
  const ia = a.id.toLowerCase();
  const ib = b.id.toLowerCase();
  return ia === ib ? 0 : ia > ib ? -1 : 1;
}

// A cursor a client sent back, or null when it isn't one. fetchMoreUwPeers
// runs this before either value reaches the RPC, since an action can be POSTed
// with anything.
export function parseUwCursor(value: unknown): UwPeerCursor | null {
  if (typeof value !== "object" || value === null) return null;
  const { ts, id } = value as Record<string, unknown>;
  if (!isIsoTimestamp(ts) || !isUuid(id)) return null;
  return { ts, id };
}

// The cursor after one bucket's rows, as the RPC returned them (sorted, at most
// UW_PEER_FETCH). A next page exists only when the extra row came back, and it
// starts after the last row SHOWN — so the extra row leads the next page.
// Computed from the raw rows, before any is dropped as malformed, so a
// dropped row can't move the cursor.
export function nextUwCursor(rows: readonly UwPeerRow[]): UwPeerCursor | null {
  if (rows.length <= UW_PEER_PAGE) return null;
  const last = rows[UW_PEER_PAGE - 1];
  return parseUwCursor({ ts: last.onboarded_at, id: last.id });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// One RPC row as a person in a group, or null for a row that isn't one.
//
// The bucket decides which of the two sublines may be set, whatever the row
// says: `matched` only in a match group, `major` only in "More at UW", and
// there only when it is a listed major. That last filter is the app's half of
// D3's rule, and only the app's: a free-text major still MATCHES (same_major
// compares by uw_norm), and the app never RENDERS it to a stranger, but the
// RPC still returns the raw value, so a caller who invokes list_uw_peers
// directly through PostgREST can read it. Closing that needs the list in SQL
// (uw-cohort.sql STEP 5); until then this is a display filter, not a gate.
export function uwPeerFromRow(row: UwPeerRow): UwGroupPeer | null {
  if (!isUwBucket(row.bucket) || !isUuid(row.id)) return null;
  const username = cleanString(row.username);
  if (!username) return null;
  const rest = row.bucket === "rest";
  return {
    userId: row.id,
    username,
    displayName: cleanString(row.display_name),
    avatarUrl: avatarPublicUrl(row.avatar_path),
    matched: rest ? null : cleanString(row.matched),
    major: rest ? listedMajor(row.major) : null,
    onboardedAt: isIsoTimestamp(row.onboarded_at) ? row.onboarded_at : null,
  };
}

// One bucket's page out of an RPC result that may hold every bucket. Rows keep
// the RPC's order, which is the cursor's order.
export function uwPeerPage(rows: readonly UwPeerRow[], bucket: UwBucket): UwPeerPage {
  const mine = rows.filter((r) => r.bucket === bucket);
  const peers: UwGroupPeer[] = [];
  for (const row of mine.slice(0, UW_PEER_PAGE)) {
    const peer = uwPeerFromRow(row);
    if (peer) peers.push(peer);
  }
  // Every row of a bucket carries the same total. Never below what is shown,
  // so a header can't read "2" over three rows. No rows, no count (see
  // UwPeerPage.total).
  if (mine.length === 0) return emptyUwPeerPage();
  const total = Number(mine[0].bucket_total);
  return {
    peers,
    total: Number.isFinite(total) && total > 0 ? Math.max(Math.floor(total), peers.length) : peers.length,
    cursor: nextUwCursor(mine),
  };
}

// The three groups from a first, every-bucket call (p_bucket null). Here a
// bucket with no rows really is empty, so its unknown total is 0.
export function buildUwPeerGroups(rows: readonly UwPeerRow[]): UwPeerGroups {
  const groups = emptyUwPeerGroups();
  for (const bucket of UW_BUCKETS) {
    const key = UW_GROUP_KEY[bucket];
    const page = uwPeerPage(rows, bucket);
    groups[key] = page.peers;
    groups.totals[key] = page.total ?? 0;
    groups.cursors[key] = page.cursor;
  }
  return groups;
}
