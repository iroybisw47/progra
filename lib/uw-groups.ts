// The UW groups as the two screens that list them draw them (plan P9d; R:131,
// R:136-141, R:168; P:1134-1154, P:1199-1202, P:1294): onboarding v3's
// Screen 5 and the v3 Friends tab. lib/uw-peers.ts turns list_uw_peers' rows
// into three groups and their cursors. This file holds what each screen then
// does with them, and the parts that can be wrong without a device:
//
//   - the headers: "In {Major}" over the viewer's majors joined with " & ",
//     "Shares your interests", "More at UW", each with its count;
//   - the line under each person, by group;
//   - who stays listed once added: everyone on Screen 5 (P:1199-1200, the
//     row turns "✓ Added" and can be undone there), nobody on the Friends tab
//     (P:1294, where a request out lives in the Sent sheet instead);
//   - "More at UW"'s further pages, merged into what's on screen without a
//     row lost or shown twice, however the first page moved meanwhile, and
//     without keeping a row a fresh first page has since dropped;
//   - which layout Screen 5 shows: the groups, a quiet wait, "You're early",
//     or the non-UW layout when the fetch failed.
//
// Pure: no React, window or server code, so lib/uw-groups.test.ts pins it.
// Who is in a group at all is list_uw_peers' decision, never this file's.
// Nothing here goes to analytics: the headers and sublines carry majors and
// interests, which stay out of every event.

import type { FriendRelations } from "@/lib/find-friends";
import { NO_OVERLAY, tabRelation, type FriendsTabOverlay } from "@/lib/friends-tab";
import { FIND_FRIENDS_COPY } from "@/lib/onboarding-v3";
import { cleanInterests, cleanMajors, normalizeMatchText } from "@/lib/uw";
import {
  UW_BUCKETS,
  UW_GROUP_KEY,
  compareUwOrder,
  type UwBucket,
  type UwGroupKey,
  type UwGroupPeer,
  type UwPeerCursor,
  type UwPeerGroups,
  type UwPeerPage,
} from "@/lib/uw-peers";

// ---- Copy -----------------------------------------------------------------------

// R:138-139 word for word. The first group's title is built (sameMajorTitle).
// Neither R nor the plan has words for the next-page row, the wait, or what
// a screen reader hears of either: the prototype lists a fixed handful and
// never pages or fetches, and R:192 asks only for "paged / infinite scroll".
// So "Show more" and the spoken lines are this build's own, for the owner to
// confirm. The row mostly loads before it's seen on Screen 5 and is a tap on
// the Friends tab (components/v2/uw-groups.tsx), and the wait is spoken only,
// under a few placeholder rows.
export const UW_GROUPS_COPY = {
  sharedInterest: "Shares your interests",
  rest: "More at UW",
  // Only reachable if the viewer's own majors arrive empty while the RPC
  // still put someone in their major (a write between two reads): the
  // fallback when neither the majors nor the rows name one.
  majorFallback: "In your major",
  showMore: "Show more",
  loading: "Finding people from UW",
  // A group's count as a screen reader hears it, in the heading's name: the
  // visible number alone says nothing about what it counts.
  people: (n: number) => (n === 1 ? "1 person" : `${n} people`),
  // Said once Screen 5's wait ends with someone to show (the other endings
  // say the note they show).
  found: (n: number) => (n === 1 ? "1 person from UW" : `${n} people from UW`),
  // fetchMoreUwPeers' own words, for a call that threw rather than answered.
  moreFailed: "Couldn't load more UW students.",
} as const;

// Each group key's bucket, the way back from UW_GROUP_KEY, for asking the
// action for a group's next page.
export const UW_BUCKET_FOR: Record<UwGroupKey, UwBucket> = {
  sameMajor: "same_major",
  sharedInterest: "shared_interest",
  rest: "rest",
};

// Each person once, first spelling kept, compared as the SQL compares them.
function uniqueByMatch(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = normalizeMatchText(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

// "In {Major}" (R:137, P:1145): the viewer's majors, every one of them,
// joined with " & ", as the profile stores them (cleanMajors: a list entry in
// the list's spelling). A double major who matches people in only one of the
// two still reads both, as the prototype's does. The majors normally come
// from the same save the RPC read, so the fallbacks are a guard: the matched
// strings on the rows, which are the viewer's own words too, then
// UW_GROUPS_COPY.majorFallback.
export function sameMajorTitle(
  majors: readonly string[],
  peers: readonly Pick<UwGroupPeer, "matched">[] = []
): string {
  const mine = cleanMajors(majors);
  const names =
    mine.length > 0
      ? mine
      : uniqueByMatch(peers.map((p) => p.matched).filter((m): m is string => !!m));
  return names.length > 0 ? `In ${names.join(" & ")}` : UW_GROUPS_COPY.majorFallback;
}

export function uwGroupTitle(
  key: UwGroupKey,
  majors: readonly string[],
  peers: readonly Pick<UwGroupPeer, "matched">[] = []
): string {
  if (key === "sameMajor") return sameMajorTitle(majors, peers);
  return key === "sharedInterest" ? UW_GROUPS_COPY.sharedInterest : UW_GROUPS_COPY.rest;
}

export type UwSubline = { text: string | null; tone: "secondary" | "faint" };

// The line under a person (R:137-139): "Also studying {matched}" and "Also
// into {matched}" in --secondary-ink, naming the viewer's own major or
// interest that matched (lib/uw-peers.ts keeps the RPC's `matched` for the
// match groups only), and in "More at UW" their major, in --faint, only when
// it's on the known list (uwPeerFromRow has already dropped a typed one). A
// row with nothing to say has no line.
export function uwSubline(key: UwGroupKey, peer: Pick<UwGroupPeer, "matched" | "major">): UwSubline {
  if (key === "rest") return { text: peer.major, tone: "faint" };
  const matched = peer.matched?.trim();
  if (!matched) return { text: null, tone: "secondary" };
  return {
    text: key === "sameMajor" ? `Also studying ${matched}` : `Also into ${matched}`,
    tone: "secondary",
  };
}

// ---- Paging ---------------------------------------------------------------------

// What a group has paged in past its first page. `peers` starts with that
// first page AS IT WAS when the next one was asked for, then each page after
// it, so the list is contiguous by construction: every page starts after the
// last row of what came before it. `cursor` is where the next page starts,
// null once there's no more.
//
// The snapshot is the point. On the Friends tab the first page is a server
// read that refreshes (an Add's revalidation, FeedLivePoll's minute), and it
// can move under the pages already loaded: someone newly listed sorts to the
// top and pushes the old first page's last row onto page two, which was
// already fetched from after it. Kept here, that row stays listed; listed
// from the fresh first page alone, it would vanish until a reload.
export type UwGroupMore = {
  peers: readonly UwGroupPeer[];
  cursor: UwPeerCursor | null;
};

export type UwPaging = Readonly<Partial<Record<UwGroupKey, UwGroupMore>>>;

export const NO_PAGING: UwPaging = {};

export function sameCursor(a: UwPeerCursor | null, b: UwPeerCursor | null): boolean {
  return a === b || (a !== null && b !== null && a.ts === b.ts && a.id === b.id);
}

// Where a group's next page starts: after what's been paged in, or after the
// first page when nothing has. Null means there's nothing more to ask for.
export function uwNextCursor(
  groups: UwPeerGroups,
  paging: UwPaging,
  key: UwGroupKey
): UwPeerCursor | null {
  const more = paging[key];
  return more ? more.cursor : groups.cursors[key];
}

// A page that came back, merged in. `request` is what it was asked with: the
// cursor, and the group's first page at that moment (the snapshot above).
// The answer to a question that's no longer the one to ask is dropped: one
// asked after a cursor the group has since paged past (a second tap's
// duplicate, or a late reply), or anything once the group says it's done.
export function mergeUwPage(
  paging: UwPaging,
  key: UwGroupKey,
  request: { after: UwPeerCursor; base: readonly UwGroupPeer[] },
  page: UwPeerPage
): UwPaging {
  const more = paging[key];
  if (more && !sameCursor(more.cursor, request.after)) return paging;
  const before = more ? more.peers : request.base;
  return { ...paging, [key]: { peers: [...before, ...page.peers], cursor: page.cursor } };
}

// The rows a group lists: the first page as it is now, then whatever was paged
// in beyond it, each person once (the fresh first page wins, in its order).
// The fresh page leads because it's the newest truth about the top of the
// list; the rest is older than its last row, so the order holds.
//
// The fresh first page is also the truth for the whole range it covers, from
// the top of the group down to `covered`, its cursor (the last row it shows).
// A paged-in row that sorts inside that range but isn't on it was left out
// by the server since: they unlisted themselves, blocked the viewer either
// way, left the cohort or lost their seat, or a friendship row appeared. So
// it goes, rather than staying listed with a live Add until the tab
// remounts. With no cursor the first page is the whole group, and every
// paged-in row it lacks goes. Only a row below the range is kept, since the
// server may simply have pushed it there (the snapshot's reason to exist):
// those pages never refresh, and their gap is friendsTabUwHide's.
export function uwGroupPeers(
  base: readonly UwGroupPeer[],
  more: UwGroupMore | undefined,
  covered: UwPeerCursor | null
): UwGroupPeer[] {
  if (!more) return [...base];
  const seen = new Set(base.map((p) => p.userId));
  const out: UwGroupPeer[] = [...base];
  for (const p of more.peers) {
    if (seen.has(p.userId) || inFirstPage(p, covered)) continue;
    seen.add(p.userId);
    out.push(p);
  }
  return out;
}

// Whether a row sorts within the range a first page ending at `covered` shows.
// A row whose place can't be read is kept unless the page is the whole group.
function inFirstPage(peer: UwGroupPeer, covered: UwPeerCursor | null): boolean {
  if (covered === null) return true;
  if (peer.onboardedAt === null) return false;
  const order = compareUwOrder({ ts: peer.onboardedAt, id: peer.userId }, covered);
  return order !== null && order <= 0;
}

// ---- Who stays listed -------------------------------------------------------------

// Why a person is out of their group, if they are:
//   null       listed
//   "settled"  the page's own reads already know (a friendship row came back
//              with them), so the RPC that read the counts left them out too
//   "pending"  only a tap in flight says so, so the counts still include them
export type UwHide = null | "settled" | "pending";

// Screen 5 (P:1199-1200): nobody leaves. An added person's row turns
// "✓ Added" and a second tap takes it back, so the row has to stay where it
// was. The groups are fetched once per answer (Screen 1's), so a request sent
// here never comes back as a fresh read that leaves them out.
export function keepEveryone(): UwHide {
  return null;
}

// The Friends tab (P:1294): anyone the viewer is already connected to leaves
// the groups, the moment the tap shows. Asked here means "Requested", and a
// request out is the Sent sheet's to show and take back (D12); a request in is
// in Requests above; a friend is in "Your friends" below. list_uw_peers leaves
// all of them out of a fresh read anyway (any friendships row, either way),
// so this covers the gap until revalidation lands, and the further pages,
// which never refresh. A request taken back from the sheet puts the person
// back where they were. Someone the viewer has blocked (`blockedIds`, the
// tab's own list) is out too, for the same further pages; the RPC leaves
// them out of a fresh read.
export function friendsTabUwHide(
  relations: FriendRelations,
  overlay: FriendsTabOverlay,
  blockedIds: ReadonlySet<string> = new Set()
): (peer: Pick<UwGroupPeer, "userId">) => UwHide {
  return (peer) => {
    if (blockedIds.has(peer.userId)) return "settled";
    if (tabRelation(relations, overlay, peer.userId).kind === "add") return null;
    return tabRelation(relations, NO_OVERLAY, peer.userId).kind === "add" ? "pending" : "settled";
  };
}

// ---- Sections ---------------------------------------------------------------------

export type UwSection = {
  key: UwGroupKey;
  bucket: UwBucket;
  title: string;
  // The header's meta (R:136): the whole group, not just what's loaded.
  count: number;
  // Who the group lists now, in order.
  peers: UwGroupPeer[];
  // Where its next page starts; non-null means a "Show more" row.
  cursor: UwPeerCursor | null;
};

// The groups as a screen lists them, in R's order, each only while it has
// someone to show or more to load (P:1151-1153: an empty group has no header).
// A person is in one group at most, the first that lists them: the buckets
// never overlap in SQL, and this keeps a refresh mid-scroll from showing a
// person twice if they ever did.
//
// The count is the group's bucket_total, less the people taken out of it
// that the total still includes: everyone hidden from the first page (it and
// the total come from the same read), and anyone hidden from a further page
// only by a tap still in flight. Someone hidden from a further page because
// the page's reads already know them was left out of that same read's total,
// so they aren't taken off twice. Never below what's listed.
export function uwSections({
  groups,
  majors,
  paging = NO_PAGING,
  hide = keepEveryone,
}: {
  groups: UwPeerGroups;
  majors: readonly string[];
  paging?: UwPaging;
  hide?: (peer: UwGroupPeer) => UwHide;
}): UwSection[] {
  const seen = new Set<string>();
  const out: UwSection[] = [];
  for (const bucket of UW_BUCKETS) {
    const key = UW_GROUP_KEY[bucket];
    const base = groups[key];
    const inBase = new Set(base.map((p) => p.userId));
    const peers: UwGroupPeer[] = [];
    let counted = 0;
    for (const p of uwGroupPeers(base, paging[key], groups.cursors[key])) {
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);
      const why = hide(p);
      if (why === null) peers.push(p);
      else if (why === "pending" || inBase.has(p.userId)) counted += 1;
    }
    const cursor = uwNextCursor(groups, paging, key);
    if (peers.length === 0 && cursor === null) continue;
    const total = Number.isFinite(groups.totals[key]) ? groups.totals[key] : 0;
    out.push({
      key,
      bucket,
      title: uwGroupTitle(key, majors, peers),
      count: Math.max(peers.length, total - counted),
      peers,
      cursor,
    });
  }
  return out;
}

// Whether a first read found nobody at all, in any group: R:141's "You're
// early" on Screen 5.
export function uwGroupsEmpty(groups: UwPeerGroups): boolean {
  return UW_BUCKETS.every((b) => groups[UW_GROUP_KEY[b]].length === 0);
}

// ---- Screen 5 -----------------------------------------------------------------------

// What a UW student's Screen 5 asks for, as a key: the answer Screen 1 saved
// moments ago, the lists as setUwProfile stores them and compared as the SQL
// compares them. Null for anyone who isn't a UW student here (UW off, or No),
// who gets the non-UW layout and no fetch.
//
// Screen 5 fetches its groups as soon as the wizard is past Screen 1, so they
// are usually in hand before it comes into view: the page that rendered the
// wizard read the profile before Screen 1 saved anything, and the RPC reads
// that save. It fetches again only when this key changes (Back to Screen 1
// and different majors), not on every visit: a fresh read would leave out the
// people added here, who have to stay listed (P:1199-1200).
export function uwFetchKey(
  uw: { majors: readonly string[]; interests: readonly string[] } | null
): string | null {
  if (!uw) return null;
  const norm = (list: string[]) => list.map(normalizeMatchText);
  return JSON.stringify([norm(cleanMajors(uw.majors)), norm(cleanInterests(uw.interests))]);
}

export type UwFetchState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; groups: UwPeerGroups };

export type FindFriendsView =
  // The note and the invite preview (R:141): not a UW student, the fetch
  // failed, or (with UW's note) nobody from UW yet.
  | { list: "preview"; sub: string; note: string }
  // A UW student's groups on their way.
  | { list: "loading"; sub: string }
  | { list: "groups"; sub: string };

// Which Screen 5 to show (R:131, R:136-141, P:1186-1203).
//
// The UW subtitle promises "a few people from UW are already here", so it
// shows only once that's known to be true: with the groups. The wait (rare,
// since the fetch starts back on Screen 2) keeps the non-UW subtitle, so the
// screen never says it and then takes it back: an empty answer at the launch,
// when most early students will find nobody, gets that same subtitle over
// "You're early", as the prototype's uw-empty scenario does. A failed fetch
// falls back to the non-UW screen whole: it can't say who's here, and the
// invite still works.
export function findFriendsView(uw: UwFetchState | null): FindFriendsView {
  const plain = { sub: FIND_FRIENDS_COPY.sub };
  if (uw === null || uw.status === "failed") {
    return { list: "preview", ...plain, note: FIND_FRIENDS_COPY.note };
  }
  if (uw.status === "loading") return { list: "loading", ...plain };
  if (uwGroupsEmpty(uw.groups)) return { list: "preview", ...plain, note: FIND_FRIENDS_COPY.early };
  return { list: "groups", sub: FIND_FRIENDS_COPY.uwSub };
}

// ---- The Friends tab -------------------------------------------------------------------

// What app/friends/page.tsx hands the tab for a UW student, with UW on: the
// first page of each group (listUwPeerGroups) and their own majors, for "In
// {Major}". Null for everyone else, which leaves the tab as it is outside the
// cohort (People on Progra). Being unlisted doesn't change it: uw_listed is
// about being seen, not seeing.
//
// `groups` is null when the read failed, which is not the same answer as
// "not in the cohort": one failed refresh (FeedLivePoll's minute, or an Add's
// revalidation) keeps the groups the tab last had rather than swapping them
// for People on Progra mid-scroll. Only a tab that never had a good read
// shows People on Progra in their place.
export type FriendsTabUw = { groups: UwPeerGroups | null; majors: readonly string[] };

export function friendsTabUw(
  profile: { is_uw?: boolean | null; uw_majors?: string[] | null } | null,
  groups: UwPeerGroups | null
): FriendsTabUw | null {
  if (profile?.is_uw !== true) return null;
  return { groups, majors: cleanMajors(profile.uw_majors) };
}
