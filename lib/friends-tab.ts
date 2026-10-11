// The v3 Friends tab (.claude/plans/onboarding-v3.md, P8; handoff R:161-169,
// D12, D13), as the parts that can be wrong without a device: what each row
// says, which sections show, what a person's row offers, and how a tap shows
// before the server answers. app/friends/friends-client-v3.tsx renders it,
// on the components onboarding v3's Screen 5 already uses
// (components/v2/{people-search,person-row,invite-tile}.tsx). Pure: no React,
// window or server code, so lib/friends-tab.test.ts pins it.
//
// "R:<line>" and "P:<line>" cite the design handoff, as the plan does.

import type { FriendRelations } from "@/lib/find-friends";
import type { BlockedEntry, PublicUser, RequestEntry } from "@/lib/db/friends";
import type { ShareOutcome } from "@/lib/invite-share";
import type { FriendsWeekRow } from "@/lib/leaderboard";
import type {
  ActionResult,
  FriendRequestResult,
  SearchUsersResult,
  UwPeerPageResult,
} from "@/lib/onboarding-v3-services";
import type { AnalyticsEvent, TrackProps } from "@/lib/telemetry/events";
import type { UwBucket, UwPeerCursor } from "@/lib/uw-peers";

// ---- Copy ---------------------------------------------------------------------

// R:162-169 where R has words, P:1288-1302 where only the prototype does, and
// D12's own for the two sections R doesn't draw (People on Progra, and the
// quiet row that holds Sent and Blocked).
export const FRIENDS_TAB_COPY = {
  eyebrow: "Friends",
  requests: "Requests",
  friends: "Your friends",
  people: "People on Progra",
  empty: "No friends yet. Search above, or send your link to a group chat.",
  sentBlocked: "Sent requests · Blocked",
  sent: "Sent requests",
  blocked: "Blocked",
  noneSent: "No requests waiting on anyone.",
  noneBlocked: "No one blocked.",
  cancel: "Cancel",
  unblock: "Unblock",
  // For a call that threw (the network) rather than answering `{ error }`;
  // an action's own message is shown when it has one.
  sendFailed: "Couldn't send request.",
  declineFailed: "Couldn't decline that request.",
  cancelFailed: "Couldn't take that request back.",
  unblockFailed: "Couldn't unblock this user.",
} as const;

// The header's meta (R:162): "{n} FRIENDS", and "1 FRIEND" for one (P:1302).
// Shown at zero too, as the prototype's is.
export function friendsCountMeta(n: number): string {
  return `${n} ${n === 1 ? "FRIEND" : "FRIENDS"}`;
}

// A request's subline (P:1291).
export function requestSubline(username: string): string {
  return `@${username} wants to be friends`;
}

type Named = { displayName: string | null; username: string };

// Someone by first name, or by handle without one, as acceptedToast does.
function firstOrHandle(person: Named): string {
  const first = person.displayName?.trim().split(/\s+/)[0];
  return first || `@${person.username}`;
}

// The pill toast once someone's unblocked from the sheet, as the current tab
// confirms it ("User unblocked"), by first name or handle like acceptedToast.
export function unblockedToast(person: Named): string {
  return `${firstOrHandle(person)} unblocked`;
}

// What a screen reader hears after the writes the pill doesn't confirm (D15
// keeps it to accept, unblock and the invite). On screen the row already says
// it: Add turns to "Requested", a declined or cancelled row goes. Spoken
// through a visually hidden status line, so the design is unchanged: the
// tab's, or the sheet's own for the sheet's writes, since the modal sheet
// hides the rest of the page from a screen reader (and the pill with it).
//
// A line goes out as { id, text }, the id new each time, so the same words
// said twice (two requests sent to two Priyas) still read as a change.
export type Said = { id: number; text: string };

export const FRIENDS_TAB_SAID = {
  sent: (person: Named) => `Request sent to ${firstOrHandle(person)}`,
  declined: (person: Named) => `Declined ${firstOrHandle(person)}'s request`,
  cancelled: (person: Named) => `Request to ${firstOrHandle(person)} cancelled`,
} as const;

// ---- "Your friends" (R:169) -----------------------------------------------------

// This week's hours on the right of a friend's row (R:169, 13/600 tabular):
// whole minutes, and once there's an hour the minutes are two digits, "6h 05m"
// and "7h 00m" as the prototype writes them (P:623, P:1268), so the column
// lines up. Under a minute is "0m" (P:1294), not formatDuration's seconds: a
// friend who hasn't tracked anything this week still gets a figure.
export function formatWeekHours(ms: number): string {
  const minutes = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60_000)) : 0;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, "0")}m`;
}

// What a friend's row shows. Built on the server (app/friends/page.tsx) from
// three reads, so the client gets strings rather than sessions and goals.
export type FriendRowView = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  // "Working on {goal}", or null for no line at all.
  subline: string | null;
  // formatWeekHours of this week's total.
  hours: string;
};

// An active goal someone shares with the viewer: listActiveGoalsForUsers'
// rows, oldest first.
export type FriendGoal = { id: string; userId: string; title: string; isPrivate: boolean };

// The privacy rule listActiveGoalsForUsers (lib/db/goals.ts) applies to what
// the database returned, on top of its own `is_private = false` filter and
// the goals RLS (owner OR are_friends AND NOT is_private). Only goals that are
// not private, and only other people's: the viewer's own private goals pass
// RLS (owner), so a caller that slipped its own id into the list must not get
// them back as a "friend's". Here, rather than inline, so a test pins it.
export function friendVisibleGoals<T extends { userId: string; isPrivate: boolean }>(
  goals: readonly T[],
  viewerId: string
): T[] {
  return goals.filter((g) => g.isPrivate === false && g.userId !== viewerId);
}

// One row per accepted friend, in listFriends' order (newest friendship
// first), which stays put while FeedLivePoll moves the hours every minute
// rather than reshuffling under a thumb. Nobody is dropped: a friend with no
// week row, or no time this week, reads "0m" (getFriendsWeekRows keeps
// zero-hour friends for exactly this; rankLeaderboard would drop them).
//
// "Working on {goal}" names, in order (plan §4.5):
//   1. the goal they've put the most time into this week that is still one
//      of their active shared goals (the week row's goals, biggest first,
//      checked against activeGoals' ids). The week row alone isn't enough:
//      its titles resolve every goal this week's sessions touched, whatever
//      its status, so a goal deleted (archived) on Tuesday would read
//      "Working on" all week. It is resolved under RLS, so a private goal
//      never has a title to show either;
//   2. failing that, their oldest active goal they share with the viewer
//      (listActiveGoalsForUsers), private ones skipped again here;
//   3. failing that, no line. Not "@handle", which the prototype falls back
//      to (P:1294): the row's title already says who it is.
export function buildFriendRows(
  friends: readonly { user: PublicUser }[],
  weekRows: readonly FriendsWeekRow[],
  activeGoals: readonly FriendGoal[]
): FriendRowView[] {
  const week = new Map(weekRows.map((r) => [r.user.userId, r]));
  const active = new Set<string>();
  const fallback = new Map<string, string>();
  for (const g of activeGoals) {
    const title = g.title.trim();
    if (g.isPrivate || !title) continue;
    active.add(g.id);
    if (!fallback.has(g.userId)) fallback.set(g.userId, title);
  }
  return friends.map(({ user }) => {
    const row = week.get(user.userId);
    const top = row?.goals.find((g) => active.has(g.id) && g.title.trim());
    const goal = top?.title.trim() || fallback.get(user.userId) || null;
    return {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      subline: goal ? `Working on ${goal}` : null,
      hours: formatWeekHours(row?.totalMs ?? 0),
    };
  });
}

// The goal the tab's invite names (lib/onboarding-v3.ts inviteText, R:144):
// the viewer's oldest active goal that isn't private. The message goes to
// people outside Progra, so a goal the viewer keeps to themselves stays out
// of it, and with none it says "my goals".
export function inviteGoalTitle(
  goals: readonly { title: string; isPrivate: boolean }[]
): string | null {
  for (const g of goals) {
    const title = g.title.trim();
    if (!g.isPrivate && title) return title;
  }
  return null;
}

// ---- Who the viewer already knows (D12) -----------------------------------------

// The page's own reads, in lib/find-friends.ts's shape, so the tab and
// onboarding's Screen 5 speak one language. No extra friendships read: the
// tab already lists friends, requests in and requests out.
export function relationsFrom(
  friendIds: readonly string[],
  incoming: readonly RequestEntry[],
  outgoing: readonly RequestEntry[]
): FriendRelations {
  return {
    friendIds,
    incoming: incoming.map((r) => ({ requestId: r.requestId, userId: r.user.userId })),
    outgoing: outgoing.map((r) => ({
      requestId: r.requestId,
      userId: r.user.userId,
      username: r.user.username,
    })),
  };
}

// ---- Taps before the server answers -----------------------------------------------

// Every write on the tab, as it shows the moment it's tapped. The client
// holds these in useOptimistic: each lasts while its action is in flight,
// and the action's revalidation (revalidateFriendSurfaces) hands back the
// page's fresh reads in the same response, which then say the same thing.
// A failure ends the transition with nothing new from the server, so the
// tap simply reverts, and the client toasts why.
export type FriendsTabOp =
  | { kind: "send"; userId: string }
  | { kind: "accept"; requestId: string }
  | { kind: "decline"; requestId: string }
  // A request of the viewer's taken back from the sheet. Carries the person
  // too, so a send made earlier in the same flight stops showing.
  | { kind: "cancel"; requestId: string; userId: string }
  | { kind: "unblock"; userId: string };

export type FriendsTabOverlay = {
  // People the viewer just asked (user ids).
  sent: readonly string[];
  // Requests in, accepted or declined (request ids).
  accepted: readonly string[];
  declined: readonly string[];
  // Requests out, taken back (request ids).
  cancelled: readonly string[];
  // People unblocked (user ids).
  unblocked: readonly string[];
};

export const NO_OVERLAY: FriendsTabOverlay = {
  sent: [],
  accepted: [],
  declined: [],
  cancelled: [],
  unblocked: [],
};

function plus(list: readonly string[], id: string): readonly string[] {
  return list.includes(id) ? list : [...list, id];
}

export function applyFriendsTabOp(
  overlay: FriendsTabOverlay,
  op: FriendsTabOp
): FriendsTabOverlay {
  switch (op.kind) {
    case "send":
      return { ...overlay, sent: plus(overlay.sent, op.userId) };
    case "accept":
      return { ...overlay, accepted: plus(overlay.accepted, op.requestId) };
    case "decline":
      return { ...overlay, declined: plus(overlay.declined, op.requestId) };
    case "cancel":
      return {
        ...overlay,
        cancelled: plus(overlay.cancelled, op.requestId),
        sent: overlay.sent.filter((id) => id !== op.userId),
      };
    case "unblock":
      return { ...overlay, unblocked: plus(overlay.unblocked, op.userId) };
  }
}

// What a person's row offers on the tab (D12, R:164): "Friends" for a friend
// (or a request just accepted here), Accept for a request waiting on the
// viewer, "Requested" for one the viewer has out (or just sent), and Add for
// anyone else. A pair has one friendships row, so without this a result who's
// a friend, or already asked, would offer an Add that can only fail.
//
// Unlike Screen 5's toggle (lib/find-friends.ts rowRelation), an Add here
// turns into "Requested" and stays: a request is taken back from the Sent
// sheet, the one place the tab lists them (D12).
export type TabRelation =
  | { kind: "friends" }
  | { kind: "accept"; requestId: string }
  | { kind: "requested" }
  | { kind: "add" };

export function tabRelation(
  relations: FriendRelations,
  overlay: FriendsTabOverlay,
  userId: string
): TabRelation {
  if (relations.friendIds.includes(userId)) return { kind: "friends" };
  const incoming = relations.incoming.find((r) => r.userId === userId);
  if (incoming) {
    if (overlay.accepted.includes(incoming.requestId)) return { kind: "friends" };
    if (!overlay.declined.includes(incoming.requestId)) {
      return { kind: "accept", requestId: incoming.requestId };
    }
  }
  if (overlay.sent.includes(userId)) return { kind: "requested" };
  const outgoing = relations.outgoing.find(
    (r) => r.userId === userId && !overlay.cancelled.includes(r.requestId)
  );
  return outgoing ? { kind: "requested" } : { kind: "add" };
}

// The Requests section: everything waiting on the viewer that they haven't
// just answered.
export function visibleRequests(
  incoming: readonly RequestEntry[],
  overlay: FriendsTabOverlay
): RequestEntry[] {
  return incoming.filter(
    (r) => !overlay.accepted.includes(r.requestId) && !overlay.declined.includes(r.requestId)
  );
}

// The sheet's "Sent requests", less any just taken back.
export function visibleOutgoing(
  outgoing: readonly RequestEntry[],
  overlay: FriendsTabOverlay
): RequestEntry[] {
  return outgoing.filter((r) => !overlay.cancelled.includes(r.requestId));
}

// The sheet's "Blocked", less any just unblocked.
export function visibleBlocked(
  blocked: readonly BlockedEntry[],
  overlay: FriendsTabOverlay
): BlockedEntry[] {
  return blocked.filter((b) => !overlay.unblocked.includes(b.user.userId));
}

// "People on Progra" (D12: the discovery list for anyone without UW groups to
// show), from listSuggestedUsers as the current tab reads it: everyone
// except the viewer's friends, who are in "Your friends", and anyone whose
// request is waiting on them, who is in Requests right above. People the
// viewer has asked stay, reading "Requested".
export function peopleOnProgra(
  suggested: readonly PublicUser[],
  relations: FriendRelations,
  overlay: FriendsTabOverlay
): PublicUser[] {
  return suggested.filter((u) => {
    const kind = tabRelation(relations, overlay, u.userId).kind;
    return kind !== "friends" && kind !== "accept";
  });
}

// ---- Layout (R:163-169) -------------------------------------------------------------

export type FriendsTabSections = {
  // The 68px invite button (R:165).
  invite: boolean;
  // The search's results, in place of everything below the field.
  results: boolean;
  requests: boolean;
  // A UW student's three groups, between Requests and "Your friends" (R:168,
  // P9d). Each group still shows only with someone in it (lib/uw-groups.ts).
  uw: boolean;
  // "Your friends" always shows while browsing; `friendsEmpty` swaps its rows
  // for the empty note (R:169).
  friends: boolean;
  friendsEmpty: boolean;
  people: boolean;
  // The quiet row that opens the Sent requests · Blocked sheet. Only when
  // there's something in it: an empty sheet is a dead end.
  sentBlocked: boolean;
};

// While searching, the invite and every section hide and only the results
// show (R:164). Otherwise: the invite, Requests when there are any, the UW
// groups when any has someone in it, "Your friends" always, People on Progra
// when there's anyone to list, and the Sent · Blocked row when either list
// has someone.
//
// People on Progra is for the viewer without UW groups (D12): anyone outside
// the cohort, with UW off, or whose groups failed to load. A UW student's
// groups take its place (R:168 lists no fourth section), so the two never
// both list the same person. Once their groups run out of people (everyone
// added, or nobody listed yet) it comes back, rather than leaving them with
// no one to find but by search.
export function friendsTabSections(input: {
  searching: boolean;
  requests: number;
  // The UW groups that have someone to show (uwSections' length), 0 for
  // anyone without them.
  uwGroups?: number;
  friends: number;
  people: number;
  sent: number;
  blocked: number;
}): FriendsTabSections {
  if (input.searching) {
    return {
      invite: false,
      results: true,
      requests: false,
      uw: false,
      friends: false,
      friendsEmpty: false,
      people: false,
      sentBlocked: false,
    };
  }
  const uw = (input.uwGroups ?? 0) > 0;
  return {
    invite: true,
    results: false,
    requests: input.requests > 0,
    uw,
    friends: true,
    friendsEmpty: input.friends === 0,
    people: !uw && input.people > 0,
    sentBlocked: input.sent + input.blocked > 0,
  };
}

// ---- Services ----------------------------------------------------------------------

// Everything the tab asks of the outside world, as one object, for the
// reason lib/onboarding-v3-services.ts gives: the dev preview
// (app/dev/friends-v3) renders the tab with no sign-in and passes fakes, and
// production passes the real actions (app/friends/services.ts). Every write
// is an existing action that already revalidates the friend surfaces.
export type FriendsTabServices = {
  searchUsers(query: string): Promise<SearchUsersResult>;
  sendFriendRequest(targetUserId: string): Promise<FriendRequestResult>;
  acceptFriendRequest(requestId: string): Promise<ActionResult>;
  // Declining a request waiting on the viewer.
  removeFriendship(id: string): Promise<ActionResult>;
  // Taking back one of the viewer's own: deletes only a row that's still
  // pending, so a cancel that lands after they accepted can't unfriend.
  cancelFriendRequest(requestId: string): Promise<ActionResult>;
  unblockUser(targetUserId: string): Promise<ActionResult>;
  // A UW group's next page (P9d): "More at UW", or a long match group. The
  // first page of each comes with the page's reads (listUwPeerGroups).
  fetchMoreUwPeers(bucket: UwBucket, cursor: UwPeerCursor): Promise<UwPeerPageResult>;
  // lib/invite-share.ts' shareInvite, which tracks invite_sent itself.
  shareInvite(text: string): Promise<ShareOutcome>;
  track(name: AnalyticsEvent, props?: TrackProps): void;
};
