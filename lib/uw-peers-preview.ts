// A made-up UW cohort and a fake list_uw_peers over it, for the dev previews
// of onboarding v3's Screen 5 (lib/onboarding-v3-preview.ts) and the v3
// Friends tab (lib/friends-v3-preview.ts). Plan P9d. Nothing here reaches a
// database or the network, and only those two harnesses import it; their
// routes 404 in production.
//
// The fake answers in the RPC's own row shape (UwPeerRow), by the rules
// uw-cohort.sql STEP 5 states, so the previews run the real shaping in
// lib/uw-peers.ts (the off-list major filter, the look-ahead cursor) and the
// real paging in lib/uw-groups.ts rather than a stand-in for them:
//   - a peer is in the first bucket that matches: same_major if any of their
//     majors equals one of the caller's (as uw_norm compares), else
//     shared_interest for an interest, else rest;
//   - `matched` is the CALLER's string, the first of theirs that matched;
//   - `major` is set for rest only: the peer's first major, raw, typed ones
//     included (the app drops those before rendering);
//   - each bucket is ordered (onboarded_at desc, id desc) and paged on its
//     own, after a keyset cursor honoured only with a bucket;
//   - `bucket_total` is the bucket's size, whatever the cursor.
// Who's in the cohort at all is the fixture's choice: everyone here is UW,
// listed and onboarded, and `exclude` stands in for the friendships and
// blocks the RPC leaves out.
//
// The people are made up, with handles that pass checkUsername, and ids that
// are real UUIDs, because uwPeerFromRow and parseUwCursor check them.

import { normalizeMatchText } from "@/lib/uw";
import {
  UW_BUCKETS,
  UW_PEER_FETCH,
  buildUwPeerGroups,
  uwPeerPage,
  type UwBucket,
  type UwPeerCursor,
  type UwPeerGroups,
  type UwPeerPage,
  type UwPeerRow,
} from "@/lib/uw-peers";

export type PreviewUwStudent = {
  id: string;
  username: string;
  displayName: string;
  majors: readonly string[];
  interests: readonly string[];
  onboardedAt: string;
};

export type PreviewUwCaller = {
  majors: readonly string[];
  interests: readonly string[];
};

// The viewer both previews' UW fixtures start as: a double major, so "In
// {Major}" shows the " & " join (R:137), with two interests.
export const PREVIEW_UW_CALLER: PreviewUwCaller = {
  majors: ["Economics", "Computer Science"],
  interests: ["Startups", "Running"],
};

// [handle, name, majors, interests]. Against PREVIEW_UW_CALLER: four share a
// major (Owen's typed in lower case, which still matches), three share only an
// interest (Mei's typed in lower case too), and the other 25 are "More at
// UW", more than one page of 20, so it has a next page to load (on scroll on
// Screen 5, from "Show more" on the Friends tab). Chloe's
// major is typed rather than picked, and Caleb gave none, so neither has a
// line (plan D3).
const PEOPLE: readonly [string, string, string[], string[]][] = [
  ["aisha_r", "Aisha Rahman", ["Economics"], ["Investing", "Hiking"]],
  ["tomasreyes", "Tomás Reyes", ["Computer Science", "Mathematics"], ["AI", "Chess"]],
  ["jordanblake", "Jordan Blake", ["Psychology"], ["Startups", "Film"]],
  ["graceliu", "Grace Liu", ["Statistics", "Economics"], ["Running"]],
  ["avathompson", "Ava Thompson", ["Psychology"], ["Music"]],
  ["meitanaka", "Mei Tanaka", ["Biology"], ["running", "Cooking"]],
  ["noahbennett", "Noah Bennett", ["Biology"], ["Hiking"]],
  ["owenpark", "Owen Park", ["computer science"], ["Photography"]],
  ["lenafischer", "Lena Fischer", ["Informatics"], ["Design"]],
  ["samokafor", "Sam Okafor", [], ["Startups"]],
  ["diegosantos", "Diego Santos", ["Mechanical Engineering"], ["Lifting"]],
  ["hanayoshida", "Hana Yoshida", ["Design"], ["Photography"]],
  ["isaacmorgan", "Isaac Morgan", ["Political Science"], ["Writing"]],
  ["chloedubois", "Chloe Dubois", ["Comparative History of Ideas"], ["Film"]],
  ["raviiyer", "Ravi Iyer", ["Bioengineering"], ["Pre-med"]],
  ["maddieclark", "Maddie Clark", ["Nursing"], ["Cooking"]],
  ["felixwagner", "Felix Wagner", ["Physics"], ["Chess"]],
  ["zoekim_uw", "Zoe Kim", ["Neuroscience"], ["Pre-med"]],
  ["omarhaddad", "Omar Haddad", ["Public Health"], ["Climbing"]],
  ["elenapetrova", "Elena Petrova", ["Mathematics"], ["Music"]],
  ["calebwright", "Caleb Wright", [], ["Climbing"]],
  ["yunachoi", "Yuna Choi", ["Communication"], ["Film"]],
  ["mateogarcia", "Mateo Garcia", ["Business Administration"], ["Investing"]],
  ["saralind", "Sara Lindqvist", ["English"], ["Writing"]],
  ["kofimensah", "Kofi Mensah", ["Chemistry"], ["Lifting"]],
  ["inesmoreau", "Ines Moreau", ["International Studies"], ["Hiking"]],
  ["bencarter", "Ben Carter", ["Philosophy"], ["Chess"]],
  ["leahgold", "Leah Goldberg", ["Biochemistry"], ["Pre-med"]],
  ["arjunmehta", "Arjun Mehta", ["Electrical & Computer Engineering"], ["AI"]],
  ["norawalsh", "Nora Walsh", ["Sociology"], ["Music"]],
  ["theolaurent", "Theo Laurent", ["Environmental Science"], ["Hiking"]],
  ["priscillang", "Priscilla Ng", ["Human Centered Design & Engineering"], ["Design"]],
];

// Newest first, 37 minutes apart, in the format the cursor passes back
// verbatim (one format throughout, so comparing the strings compares times).
const NEWEST = Date.UTC(2026, 9, 8, 18, 0, 0);

export const PREVIEW_UW_COHORT: readonly PreviewUwStudent[] = PEOPLE.map(
  ([username, displayName, majors, interests], i) => ({
    id: `00000000-0000-4000-8000-${String(9000 + i).padStart(12, "0")}`,
    username,
    displayName,
    majors,
    interests,
    onboardedAt: new Date(NEWEST - i * 37 * 60_000).toISOString(),
  })
);

// The caller's first string that one of the peer's equals, as the SQL's
// `unnest(me.majors) with ordinality … order by x.i limit 1` picks it.
function firstMatch(mine: readonly string[], theirs: readonly string[]): string | null {
  const keys = new Set(theirs.map(normalizeMatchText));
  return mine.find((m) => keys.has(normalizeMatchText(m))) ?? null;
}

// (onboarded_at, id) descending, as the RPC orders a bucket.
function newerFirst(a: PreviewUwStudent, b: PreviewUwStudent): number {
  if (a.onboardedAt !== b.onboardedAt) return a.onboardedAt < b.onboardedAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// The row-value comparison `(onboarded_at, id) < (after_ts, after_id)`.
function isAfter(s: PreviewUwStudent, after: UwPeerCursor): boolean {
  return s.onboardedAt < after.ts || (s.onboardedAt === after.ts && s.id < after.id);
}

// list_uw_peers(p_bucket, p_limit, p_after_ts, p_after_id) over `cohort`, as
// `caller` would call it.
export function fakeListUwPeers(
  cohort: readonly PreviewUwStudent[],
  caller: PreviewUwCaller,
  {
    bucket = null,
    limit = 20,
    after = null,
    exclude = new Set<string>(),
  }: {
    bucket?: UwBucket | null;
    limit?: number;
    after?: UwPeerCursor | null;
    exclude?: ReadonlySet<string>;
  } = {}
): UwPeerRow[] {
  const cap = Math.max(1, Math.min(Math.floor(limit), 50));
  const sorted = cohort.filter((s) => !exclude.has(s.id)).sort(newerFirst);
  const placed = sorted.map((s) => {
    const major = firstMatch(caller.majors, s.majors);
    const interest = major ? null : firstMatch(caller.interests, s.interests);
    const b: UwBucket = major ? "same_major" : interest ? "shared_interest" : "rest";
    return { s, bucket: b, matched: major ?? interest };
  });
  const out: UwPeerRow[] = [];
  for (const b of UW_BUCKETS) {
    if (bucket !== null && b !== bucket) continue;
    const mine = placed.filter((p) => p.bucket === b);
    const paged = bucket !== null && after ? mine.filter((p) => isAfter(p.s, after)) : mine;
    for (const p of paged.slice(0, cap)) {
      out.push({
        id: p.s.id,
        username: p.s.username,
        display_name: p.s.displayName,
        avatar_path: null,
        bucket: b,
        matched: p.matched,
        major: b === "rest" ? (p.s.majors[0] ?? null) : null,
        onboarded_at: p.s.onboardedAt,
        bucket_total: mine.length,
      });
    }
  }
  return out;
}

// The first page of every group, as listUwPeerGroups shapes the RPC's rows.
export function fakeUwPeerGroups(
  cohort: readonly PreviewUwStudent[],
  caller: PreviewUwCaller,
  exclude?: ReadonlySet<string>
): UwPeerGroups {
  return buildUwPeerGroups(fakeListUwPeers(cohort, caller, { limit: UW_PEER_FETCH, exclude }));
}

// One group's page after a cursor, as listUwPeerPage shapes it.
export function fakeUwPeerPage(
  cohort: readonly PreviewUwStudent[],
  caller: PreviewUwCaller,
  bucket: UwBucket,
  after: UwPeerCursor,
  exclude?: ReadonlySet<string>
): UwPeerPage {
  return uwPeerPage(
    fakeListUwPeers(cohort, caller, { bucket, after, limit: UW_PEER_FETCH, exclude }),
    bucket
  );
}
