// The dev-only screenshot harness for the v3 Friends tab (app/dev/friends-v3):
// which fixture a URL asks for, the friends world each fixture stands for,
// and fake services in place of the friend actions. Nothing here reaches a
// database or the network. Only that route imports it, and the route 404s in
// production.
//
// The fixtures are the page's reads as app/friends/page.tsx would hand them
// over, and "Your friends" goes through the same buildFriendRows, so a
// screenshot shows what the real rows would. The people are made up, after
// the prototype's (P:610-629), with handles that pass checkUsername (D8 has
// no dots, so the prototype's "leo.m" and "nina.k" are leo_m and nina_k).

import type { BlockedEntry, PublicUser, RequestEntry } from "@/lib/db/friends";
import {
  buildFriendRows,
  type FriendGoal,
  type FriendRowView,
  type FriendsTabServices,
} from "@/lib/friends-tab";
import type { FriendsWeekRow } from "@/lib/leaderboard";
import { PREVIEW_LATENCY_MS } from "@/lib/onboarding-v3-preview";
import type { SearchedUser } from "@/lib/onboarding-v3-services";
import {
  SEARCH_QUERY_MIN,
  SEARCH_RESULTS_MAX,
  normalizeSearchQuery,
  orderSearchMatches,
} from "@/lib/social/username";
import type { FriendsTabUw } from "@/lib/uw-groups";
import { emptyUwPeerGroups, isUwBucket, parseUwCursor } from "@/lib/uw-peers";
import {
  PREVIEW_UW_CALLER,
  PREVIEW_UW_COHORT,
  fakeUwPeerGroups,
  fakeUwPeerPage,
} from "@/lib/uw-peers-preview";

// default  two requests (Leo, Nina); three friends: one with this week's
//          goal, one at 0h falling back to an active goal, one with no goal
//          to name (a private one only); People on Progra; one request out
//          and one person blocked, so the Sent · Blocked row shows
// empty    a new account: no friends, no requests, nothing out or blocked,
//          People on Progra only
// search   default, searching "pri": a friend ("Friends"), a request out
//          ("Requested") and a stranger ("Add")
// sheet    default with the Sent requests · Blocked sheet open
// uw       default for a UW student (P9d): the two requests, then the three
//          UW groups from the made-up cohort (lib/uw-peers-preview.ts, "More
//          at UW" a page and a bit long), then the three friends. People on
//          Progra gives way to the groups (D12)
export const FRIENDS_PREVIEW_FIXTURES = ["default", "empty", "search", "sheet", "uw"] as const;
export type FriendsPreviewFixture = (typeof FRIENDS_PREVIEW_FIXTURES)[number];

// The page's reads, as FriendsClientV3 takes them.
export type FriendsPreviewData = {
  friends: FriendRowView[];
  incoming: RequestEntry[];
  outgoing: RequestEntry[];
  blocked: BlockedEntry[];
  suggested: PublicUser[];
  // A UW student's groups (friendsTabUw), or null outside the cohort.
  uw: FriendsTabUw | null;
};

function person(username: string, displayName: string): PublicUser {
  return { userId: `preview-user-${username}`, username, displayName, bio: null, avatarUrl: null };
}

const LEO = person("leo_m", "Leo Martins");
const NINA = person("nina_k", "Nina Kowalski");
const PRIYA = person("priyaraman", "Priya Raman");
const MARCUS = person("marcuslee", "Marcus Lee");
const SOFIA = person("sofia_alv", "Sofia Alvarez");
const PRIYANKA = person("priyankad", "Priyanka Das");
const PRIYA_SHAH = person("priya_shah", "Priya Shah");
const ZACK = person("zackmoore", "Zack Moore");
const ETHAN = person("ebrooks", "Ethan Brooks");
const HANNAH = person("hannahcho", "Hannah Cho");
const DANIEL = person("dkim", "Daniel Kim");

// Everyone the fake search can find. Daniel is blocked, and search_users
// never returns a block in either direction, so he isn't here.
export const FRIENDS_PREVIEW_PEOPLE: readonly PublicUser[] = [
  LEO,
  NINA,
  PRIYA,
  MARCUS,
  SOFIA,
  PRIYANKA,
  PRIYA_SHAH,
  ZACK,
  ETHAN,
  HANNAH,
];

// The viewer's goal the invite names.
export const PREVIEW_INVITE_GOAL = "Ship my portfolio site";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function weekRow(user: PublicUser, totalMs: number, goal: string | null): FriendsWeekRow {
  const goals = goal ? [{ id: `preview-goal-${user.username}`, title: goal, color: null, ms: totalMs }] : [];
  return { user, isMe: false, totalMs, goals, goalCount: goals.length, otherMs: goal ? 0 : totalMs };
}

// Priya worked on a goal this week (its title wins); Marcus tracked nothing,
// so his row reads 0m and names his oldest shared goal; Sofia tracked
// category time only and keeps her one goal private, so there's no line.
const FRIENDS = buildFriendRows(
  [{ user: PRIYA }, { user: MARCUS }, { user: SOFIA }],
  [
    weekRow(PRIYA, 9 * HOUR + 10 * MINUTE, "Pass the CFA Level I"),
    weekRow(MARCUS, 0, null),
    weekRow(SOFIA, 7 * HOUR + 45 * MINUTE, null),
  ],
  [
    // Priya's week goal is still active, so its title stands.
    {
      id: `preview-goal-${PRIYA.username}`,
      userId: PRIYA.userId,
      title: "Pass the CFA Level I",
      isPrivate: false,
    },
    { id: "preview-goal-marcus", userId: MARCUS.userId, title: "Ship my portfolio site", isPrivate: false },
    { id: "preview-goal-sofia", userId: SOFIA.userId, title: "Therapy homework", isPrivate: true },
  ] satisfies FriendGoal[]
);

// listSuggestedUsers: everyone else, by handle, friends and requesters
// included (the tab filters them out).
const SUGGESTED = [...FRIENDS_PREVIEW_PEOPLE].sort((a, b) => a.username.localeCompare(b.username));

const WORLD: FriendsPreviewData = {
  friends: FRIENDS,
  incoming: [
    { requestId: "preview-request-leo", user: LEO },
    { requestId: "preview-request-nina", user: NINA },
  ],
  outgoing: [{ requestId: "preview-request-priyanka", user: PRIYANKA }],
  blocked: [{ user: DANIEL }],
  suggested: SUGGESTED,
  uw: null,
};

const EMPTY: FriendsPreviewData = {
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
  suggested: SUGGESTED,
  uw: null,
};

// The made-up UW students as the tab's rows know people: their public
// identity, so an Add to one lands in the Sent sheet like any other.
const UW_PEOPLE: readonly PublicUser[] = PREVIEW_UW_COHORT.map((s) => ({
  userId: s.id,
  username: s.username,
  displayName: s.displayName,
  bio: null,
  avatarUrl: null,
}));

// Everyone the viewer has a row with, either way, and everyone blocked: who
// list_uw_peers leaves out.
function connectedIds(data: FriendsPreviewData): Set<string> {
  return new Set([
    ...data.friends.map((f) => f.userId),
    ...data.incoming.map((r) => r.user.userId),
    ...data.outgoing.map((r) => r.user.userId),
    ...data.blocked.map((b) => b.user.userId),
  ]);
}

// The groups as a fresh listUwPeerGroups would read them for this world: the
// fake RPC over the cohort, as PREVIEW_UW_CALLER, without anyone connected.
// Run again after every write, as revalidation runs the real one.
function withUwGroups(data: FriendsPreviewData): FriendsPreviewData {
  if (!data.uw) return data;
  const groups = fakeUwPeerGroups(PREVIEW_UW_COHORT, PREVIEW_UW_CALLER, connectedIds(data));
  return { ...data, uw: { ...data.uw, groups } };
}

// The default world, for a UW student. withUwGroups reads the groups.
const UW_WORLD: FriendsPreviewData = withUwGroups({
  ...WORLD,
  uw: { groups: emptyUwPeerGroups(), majors: PREVIEW_UW_CALLER.majors },
});

export function friendsPreviewData(fixture: FriendsPreviewFixture): FriendsPreviewData {
  if (fixture === "empty") return EMPTY;
  return fixture === "uw" ? UW_WORLD : WORLD;
}

// What the fixture opens with: the search typed, or the sheet open.
export function friendsPreviewStart(fixture: FriendsPreviewFixture): {
  query?: string;
  sheetOpen: boolean;
} {
  if (fixture === "search") return { query: "pri", sheetOpen: false };
  return { sheetOpen: fixture === "sheet" };
}

type Params = Record<string, string | string[] | undefined>;

// `?fixture=<one of FRIENDS_PREVIEW_FIXTURES>`. An unknown one is "default",
// rather than an error, since this is a tool for taking pictures.
export function parseFriendsPreviewParams(params: Params): { fixture: FriendsPreviewFixture } {
  const raw = Array.isArray(params.fixture) ? params.fixture[0] : params.fixture;
  const fixture = (FRIENDS_PREVIEW_FIXTURES as readonly string[]).includes(raw ?? "")
    ? (raw as FriendsPreviewFixture)
    : "default";
  return { fixture };
}

// searchUsers' contract over FRIENDS_PREVIEW_PEOPLE, as the onboarding
// preview's fakeSearchUsers: "@" ignored, too short finds no one, a handle or
// display name that starts with the query (the live prefix rule, D10), in the
// action's match order, at most five.
export function fakeFriendsSearch(query: unknown): { results: SearchedUser[] } {
  if (typeof query !== "string") return { results: [] };
  const q = normalizeSearchQuery(query);
  if (q.length < SEARCH_QUERY_MIN) return { results: [] };
  const found = FRIENDS_PREVIEW_PEOPLE.filter(
    (p) => p.username.startsWith(q) || (p.displayName ?? "").toLowerCase().startsWith(q)
  );
  return { results: orderSearchMatches(found, q).slice(0, SEARCH_RESULTS_MAX) };
}

// A write the fake services make, applied to the preview's own copy of the
// reads, which is what revalidation does for the real page: the client gets
// new props, and its optimistic overlay then agrees with them. The UW groups
// are read again too, so an Add leaves them and a cancel brings someone
// back, as list_uw_peers would.
export type FriendsPreviewWrite =
  | { kind: "send"; userId: string; requestId: string }
  | { kind: "accept"; requestId: string }
  // Decline (removeFriendship) and cancel (cancelFriendRequest) both delete
  // a pending row.
  | { kind: "remove"; requestId: string }
  | { kind: "unblock"; userId: string };

export function applyPreviewWrite(
  data: FriendsPreviewData,
  write: FriendsPreviewWrite
): FriendsPreviewData {
  const next = applyWrite(data, write);
  return next === data ? data : withUwGroups(next);
}

function applyWrite(data: FriendsPreviewData, write: FriendsPreviewWrite): FriendsPreviewData {
  switch (write.kind) {
    case "send": {
      const user = [...FRIENDS_PREVIEW_PEOPLE, ...UW_PEOPLE].find((p) => p.userId === write.userId);
      if (!user || data.outgoing.some((r) => r.user.userId === write.userId)) return data;
      return { ...data, outgoing: [{ requestId: write.requestId, user }, ...data.outgoing] };
    }
    case "accept": {
      const request = data.incoming.find((r) => r.requestId === write.requestId);
      if (!request) return data;
      // A new friend reads as buildFriendRows has them with no time and no
      // goal shared yet, newest first as listFriends orders them.
      const [row] = buildFriendRows([{ user: request.user }], [], []);
      return {
        ...data,
        incoming: data.incoming.filter((r) => r.requestId !== write.requestId),
        friends: [row, ...data.friends],
      };
    }
    case "remove":
      return {
        ...data,
        incoming: data.incoming.filter((r) => r.requestId !== write.requestId),
        outgoing: data.outgoing.filter((r) => r.requestId !== write.requestId),
      };
    case "unblock":
      return { ...data, blocked: data.blocked.filter((b) => b.user.userId !== write.userId) };
  }
}

function after<T>(ms: number, value: () => T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value()), ms));
}

// Services that answer like the real ones, after `latencyMs`, write only to
// the preview's own copy (through `write`, just before answering, as a real
// action's revalidation lands with its answer), and send nothing anywhere.
// Every write succeeds. A share always "went through", with no sheet. The
// analytics calls do nothing. A UW group's next page comes from the fake
// list_uw_peers over the made-up cohort, as PREVIEW_UW_CALLER. It leaves
// nobody out, unlike the real one: these services can't see the preview's
// copy of the reads, and the tab takes out anyone it's connected to itself
// (friendsTabUwHide), which is the behaviour worth watching.
export function createFriendsPreviewServices(
  write: (w: FriendsPreviewWrite) => void,
  latencyMs = PREVIEW_LATENCY_MS
): FriendsTabServices {
  let made = 0;
  const ok = (w: FriendsPreviewWrite) =>
    after(latencyMs, () => {
      write(w);
      return { ok: true as const };
    });
  return {
    searchUsers: (query) => after(latencyMs, () => fakeFriendsSearch(query)),
    sendFriendRequest: (userId) =>
      after(latencyMs, () => {
        const requestId = `preview-request-new-${++made}`;
        write({ kind: "send", userId, requestId });
        return { ok: true as const, requestId };
      }),
    acceptFriendRequest: (requestId) => ok({ kind: "accept", requestId }),
    removeFriendship: (requestId) => ok({ kind: "remove", requestId }),
    cancelFriendRequest: (requestId) => ok({ kind: "remove", requestId }),
    unblockUser: (userId) => ok({ kind: "unblock", userId }),
    fetchMoreUwPeers: (bucket, cursor) =>
      after(latencyMs, () => {
        const from = parseUwCursor(cursor);
        if (!isUwBucket(bucket) || !from) return { error: "Couldn't load more UW students." };
        return { page: fakeUwPeerPage(PREVIEW_UW_COHORT, PREVIEW_UW_CALLER, bucket, from) };
      }),
    shareInvite: () => after(latencyMs, () => "shared" as const),
    track: () => {},
  };
}
