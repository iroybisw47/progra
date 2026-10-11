// Finding friends in the redesign (.claude/plans/onboarding-v3.md, P6): the
// people search, the Add → "✓ Added" toggle and the invite tile, as the parts
// that can be wrong without a device. Onboarding v3's Screen 5 renders them
// now (app/onboarding/v3/find-friends-screen.tsx), and the v3 Friends tab (P8)
// reuses the same components (components/v2/{people-search,person-row,
// invite-tile}.tsx), so nothing here is onboarding's alone. Pure: no React,
// window or server code, so lib/find-friends.test.ts pins it.
//
// "R:<line>" and "P:<line>" cite the design handoff, as the plan does.

import { SEARCH_QUERY_MIN, SEARCH_RESULTS_MAX, normalizeSearchQuery } from "@/lib/social/username";
import type { ShareOutcome } from "@/lib/invite-share";

// ---- Search (R:134, D10) --------------------------------------------------------

// The copy around the search field, exact (R:134). The hint names two handles
// as examples of what to type. They're examples, not people the app knows.
export const SEARCH_COPY = {
  placeholder: "Search by username",
  cancel: "Cancel",
  results: "Results",
  hint: "Type a username, like “priya” or “zack”.",
  noHits: "No one with that username yet. Send them your link instead.",
  // R has no line for the wait or a failure: the prototype searches a local
  // list and never does either.
  searching: "Searching…",
  failed: "Couldn't search right now. Check your connection.",
} as const;

// How long typing has to pause before a search goes out. The current Friends
// tab's (app/friends/friends-client.tsx), so the two feel the same.
export const SEARCH_DEBOUNCE_MS = 300;

// The field's maxLength (P:1159). No handle is longer than 20, and a display
// name match doesn't need more.
export const SEARCH_INPUT_MAX = 30;

// How long focus may be gone before the field counts as blurred (P:732). A tap
// that moves focus between two controls (the field, then Cancel) blurs and
// refocuses within a frame or two, and search mode shouldn't flicker out and
// back for it.
export const SEARCH_BLUR_DEBOUNCE_MS = 120;

// Search mode is "focused or non-empty" (R:134, P:1183): the field takes over
// the screen while it has the keyboard or holds a query, and gives it back
// once it has neither. Whitespace alone isn't a query.
export function isSearchMode(focused: boolean, text: string): boolean {
  return focused || text.trim().length > 0;
}

// The last answer the search gave, for the query it was asked (normalized).
export type SearchAnswer<T> = { q: string; rows: readonly T[] } | { q: string; error: string };

export type SearchView<T> =
  // Under SEARCH_QUERY_MIN after the "@" is stripped: the hint.
  | { kind: "hint" }
  // The first answer for this query isn't back and there's nothing related
  // to show meanwhile.
  | { kind: "searching" }
  // Rows to list. `stale` when they answer an earlier, related query (the
  // query typed on from it, or backspaced to it) and this one's still out.
  | { kind: "results"; rows: readonly T[]; stale: boolean }
  | { kind: "none" }
  | { kind: "error"; message: string };

// What the list under the field shows for `text`, given the last answer.
// The query is normalized exactly as searchUsers normalizes it
// (normalizeSearchQuery: trimmed, lowercased, leading "@" dropped), so "@pr"
// and "pr" are the same search and "@p" is still too short.
//
// While a query is out, the rows for the one just before it stay up if the two
// are related, so typing "priy" after "pri" doesn't blank the list between
// keystrokes. An unrelated old answer ("zack" while "pri" is out) is never
// shown under a new query, and neither is an old "no one" or error, which
// would claim something about the new query that hasn't been asked. Rows are
// capped at SEARCH_RESULTS_MAX here as well as in the action, so a search that
// returns more (a future RPC body, or a fake) still lists five (R:134).
export function searchView<T>(text: string, last: SearchAnswer<T> | null): SearchView<T> {
  const q = normalizeSearchQuery(text);
  if (q.length < SEARCH_QUERY_MIN) return { kind: "hint" };
  if (last && last.q === q) {
    if ("error" in last) return { kind: "error", message: last.error };
    if (last.rows.length === 0) return { kind: "none" };
    return { kind: "results", rows: last.rows.slice(0, SEARCH_RESULTS_MAX), stale: false };
  }
  const related = last !== null && (q.startsWith(last.q) || last.q.startsWith(q));
  if (related && "rows" in last && last.rows.length > 0) {
    return { kind: "results", rows: last.rows.slice(0, SEARCH_RESULTS_MAX), stale: true };
  }
  return { kind: "searching" };
}

// What a screen reader hears as the list changes. Nothing for the hint (it's
// on screen under the field) or the wait, which would chatter on every
// keystroke.
export function searchAnnouncement(view: SearchView<unknown>): string {
  switch (view.kind) {
    case "results": {
      const n = view.rows.length;
      return view.stale ? "" : `${n} ${n === 1 ? "result" : "results"}`;
    }
    case "none":
      return SEARCH_COPY.noHits;
    case "error":
      return view.message;
    default:
      return "";
  }
}

// ---- Add → "✓ Added" (R:140, D13) ----------------------------------------------

// "Added" is a friend request sent and still pending (D13), and tapping
// "✓ Added" again takes it back (R:140). One person's toggle, by username:
//
//   want       what the button shows: what the person last asked for
//   requestId  the pending row the server made for this toggle, once it has
//              answered (sendFriendRequest's requestId), which is what an undo
//              takes back (cancelFriendRequest)
//   busy       a call for this person is in flight
//
// The button flips on the tap, before the server answers, and a call goes out
// only when `want` and the server disagree and nothing is already in flight
// for that person. So tapping Add, then "✓ Added" while the send is still out,
// sends and then removes, in order, rather than racing an undo that has no
// row to delete yet. A failure puts the button back to what the server holds.
export type AddEntry = {
  userId: string;
  want: boolean;
  requestId: string | null;
  busy: boolean;
};

export type FriendAdds = Readonly<Record<string, AddEntry>>;

export type AddPerson = { username: string; userId: string };

export type AddCall =
  | { username: string; kind: "send"; userId: string }
  | { username: string; kind: "remove"; requestId: string };

export type AddCallResult = { ok: true; requestId?: string } | { error: string };

// The toast for a call that failed without a message of its own (a network
// error rather than the action's `{ error }`).
export const ADD_FAILED = "Couldn't send that request. Try again.";
export const UNDO_FAILED = "Couldn't take that request back. Try again.";

export function isAdded(adds: FriendAdds, username: string): boolean {
  return adds[username]?.want === true;
}

// How many people show "✓ Added": the number Screen 5's CTA counts (R:143).
export function addedCount(adds: FriendAdds): number {
  return Object.values(adds).filter((e) => e.want).length;
}

// The tap.
export function toggleAdd(adds: FriendAdds, person: AddPerson): FriendAdds {
  const entry = adds[person.username];
  if (!entry) {
    return {
      ...adds,
      [person.username]: { userId: person.userId, want: true, requestId: null, busy: false },
    };
  }
  return { ...adds, [person.username]: { ...entry, want: !entry.want } };
}

// The call that would bring the server round to what the button shows, or
// null if it already agrees or a call for this person is still out (it's
// asked again when that one settles).
export function nextAddCall(adds: FriendAdds, username: string): AddCall | null {
  const entry = adds[username];
  if (!entry || entry.busy) return null;
  if (entry.want && entry.requestId === null) {
    return { username, kind: "send", userId: entry.userId };
  }
  if (!entry.want && entry.requestId !== null) {
    return { username, kind: "remove", requestId: entry.requestId };
  }
  return null;
}

export function startAddCall(adds: FriendAdds, call: AddCall): FriendAdds {
  const entry = adds[call.username];
  if (!entry) return adds;
  return { ...adds, [call.username]: { ...entry, busy: true } };
}

// A call's answer, applied. On success the server's side moves (a request id
// arrives, or goes). On failure it doesn't, and the button goes back to match
// it. `failed` is true when that changed what the button shows: the person's
// latest tap couldn't be honoured, so they need telling. A send that fails
// after they've already taken it back is no news.
//
// A send that "succeeds" without an id can't be undone from here, so it counts
// as a failure. sendFriendRequest always returns one.
export function settleAddCall(
  adds: FriendAdds,
  call: AddCall,
  result: AddCallResult
): { adds: FriendAdds; failed: boolean } {
  const entry = adds[call.username];
  if (!entry) return { adds, failed: false };
  const ok =
    !("error" in result) && (call.kind === "remove" || typeof result.requestId === "string");
  if (ok) {
    const requestId = call.kind === "send" ? (result as { requestId: string }).requestId : null;
    const next = { ...entry, busy: false, requestId };
    return { adds: { ...adds, [call.username]: next }, failed: false };
  }
  const want = entry.requestId !== null;
  return {
    adds: { ...adds, [call.username]: { ...entry, busy: false, want } },
    failed: want !== entry.want,
  };
}

// ---- Who the viewer already knows (D12, R:164) ---------------------------------

// The viewer's friendships as the page read them (lib/db/friends.ts
// getFriendRelations): accepted friends by id, the requests they've sent that
// are still pending (by handle too, which the toggle is keyed by), and the
// ones waiting on them. A pair has one row, so without this a search result
// who's already a friend, or already asked, would offer an Add that can only
// fail. Fresh accounts have none of it.
export type FriendRelations = {
  friendIds: readonly string[];
  outgoing: readonly { requestId: string; userId: string; username: string }[];
  incoming: readonly { requestId: string; userId: string }[];
};

export const NO_RELATIONS: FriendRelations = { friendIds: [], outgoing: [], incoming: [] };

// Requests already out start as "✓ Added", with the row an undo takes back: a
// wizard reloaded (or relaunched) after Adds, a replayer's old requests, or the
// pending request an /i/ link makes to the inviter (D1). Counted by the CTA
// like any other add.
export function addsFromOutgoing(outgoing: FriendRelations["outgoing"]): FriendAdds {
  const adds: Record<string, AddEntry> = {};
  for (const r of outgoing) {
    adds[r.username] = { userId: r.userId, want: true, requestId: r.requestId, busy: false };
  }
  return adds;
}

export type RowRelation =
  | { kind: "add" }
  | { kind: "friends" }
  | { kind: "accept"; requestId: string };

// What a search result's row offers (D12, the Friends tab's rule): "Friends"
// for a friend, or one just accepted from here (`acceptedIds`); Accept for a
// request waiting on the viewer; otherwise the Add toggle, which already shows
// a request they sent as "✓ Added" (addsFromOutgoing).
export function rowRelation(
  relations: FriendRelations,
  userId: string,
  acceptedIds: ReadonlySet<string> = new Set()
): RowRelation {
  if (acceptedIds.has(userId) || relations.friendIds.includes(userId)) return { kind: "friends" };
  const incoming = relations.incoming.find((r) => r.userId === userId);
  return incoming ? { kind: "accept", requestId: incoming.requestId } : { kind: "add" };
}

// The pill toast once a request is accepted from a row (plan P8's copy), by
// first name, or by handle for someone with no name.
export function acceptedToast(person: { displayName: string | null; username: string }): string {
  const first = person.displayName?.trim().split(/\s+/)[0];
  return `You and ${first || `@${person.username}`} are now friends`;
}

export const ACCEPT_FAILED = "Couldn't accept request.";

// ---- The invite tile (R:133, D9) -----------------------------------------------

// The navy invite button's words. After a share the line changes for good.
// R says "Sent to {chat}", but navigator.share never reports where it went
// (D9), so it names no chat. A copy doesn't count as sent (P:1208): the link
// is only on the clipboard.
export const INVITE_COPY = {
  title: "Invite your friends",
  sub: "Drop your link in the group chat",
  subSent: "Sent. Send it to another chat",
  failed: "Couldn't share the invite. Try again.",
} as const;

export function inviteTileSub(sent: boolean): string {
  return sent ? INVITE_COPY.subSent : INVITE_COPY.sub;
}

// The success toast for how a share ended (D9, D15's pill toast), or null when
// there's nothing to say: a dismissed sheet is the person changing their mind,
// and a failure is an error toast, not this.
export function inviteToast(outcome: ShareOutcome): string | null {
  if (outcome === "shared") return "Invite shared";
  if (outcome === "copied") return "Invite link copied";
  return null;
}

// Whether the invite button breathes right now (R:133, plan P6): only while
// its screen wants it (`on`: in front, and not searching), never under
// reduced motion (R:54), and only while it's on screen and the page is
// visible, so an infinite animation doesn't run where no one can see it.
export function shouldBreathe({
  on,
  reduced,
  inView,
  hidden,
}: {
  on: boolean;
  reduced: boolean;
  inView: boolean;
  hidden: boolean;
}): boolean {
  return on && !reduced && inView && !hidden;
}
