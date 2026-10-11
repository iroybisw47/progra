import { describe, expect, it } from "vitest";

import type { BlockedEntry, PublicUser, RequestEntry } from "@/lib/db/friends";
import {
  FRIENDS_TAB_COPY,
  NO_OVERLAY,
  applyFriendsTabOp,
  buildFriendRows,
  formatWeekHours,
  friendVisibleGoals,
  friendsCountMeta,
  friendsTabSections,
  inviteGoalTitle,
  peopleOnProgra,
  relationsFrom,
  requestSubline,
  tabRelation,
  unblockedToast,
  FRIENDS_TAB_SAID,
  visibleBlocked,
  visibleOutgoing,
  visibleRequests,
  type FriendsTabOp,
  type FriendsTabOverlay,
} from "@/lib/friends-tab";
import { buildFriendsWeekRows, leaderboardWeekWindow, type FriendsWeekRow } from "@/lib/leaderboard";
import type { Session } from "@/lib/storage";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function user(id: string, displayName: string | null = null): PublicUser {
  return { userId: id, username: id, displayName, bio: null, avatarUrl: null };
}

function weekRow(u: PublicUser, totalMs: number, goals: string[] = []): FriendsWeekRow {
  return {
    user: u,
    isMe: false,
    totalMs,
    goals: goals.map((title, i) => ({ id: `${u.userId}-g${i}`, title, color: null, ms: totalMs })),
    otherMs: goals.length ? 0 : totalMs,
  };
}

function ops(...list: FriendsTabOp[]): FriendsTabOverlay {
  return list.reduce(applyFriendsTabOp, NO_OVERLAY);
}

describe("friendsCountMeta (R:162, P:1302)", () => {
  it("says FRIEND for one and FRIENDS otherwise, zero included", () => {
    expect(friendsCountMeta(1)).toBe("1 FRIEND");
    expect(friendsCountMeta(0)).toBe("0 FRIENDS");
    expect(friendsCountMeta(2)).toBe("2 FRIENDS");
    expect(friendsCountMeta(12)).toBe("12 FRIENDS");
  });
});

describe("copy", () => {
  it("is the README's where it has words", () => {
    expect(FRIENDS_TAB_COPY.empty).toBe(
      "No friends yet. Search above, or send your link to a group chat."
    );
    expect(FRIENDS_TAB_COPY.requests).toBe("Requests");
    expect(FRIENDS_TAB_COPY.friends).toBe("Your friends");
    expect(FRIENDS_TAB_COPY.sentBlocked).toBe("Sent requests · Blocked");
  });

  it("names the requester under a request (P:1291)", () => {
    expect(requestSubline("leo_m")).toBe("@leo_m wants to be friends");
  });

  it("confirms an unblock by first name, or handle", () => {
    expect(unblockedToast({ displayName: "Daniel Kim", username: "dkim" })).toBe("Daniel unblocked");
    expect(unblockedToast({ displayName: "  ", username: "dkim" })).toBe("@dkim unblocked");
    expect(unblockedToast({ displayName: null, username: "dkim" })).toBe("@dkim unblocked");
  });

  it("tells a screen reader what the pill doesn't, by first name or handle", () => {
    const daniel = { displayName: "Daniel Kim", username: "dkim" };
    const nameless = { displayName: null, username: "dkim" };
    expect(FRIENDS_TAB_SAID.sent(daniel)).toBe("Request sent to Daniel");
    expect(FRIENDS_TAB_SAID.declined(daniel)).toBe("Declined Daniel's request");
    expect(FRIENDS_TAB_SAID.cancelled(nameless)).toBe("Request to @dkim cancelled");
  });
});

describe("formatWeekHours (R:169)", () => {
  it("is 0m for nothing, and for under a minute", () => {
    expect(formatWeekHours(0)).toBe("0m");
    expect(formatWeekHours(59_999)).toBe("0m");
  });

  it("is whole minutes under an hour", () => {
    expect(formatWeekHours(MINUTE)).toBe("1m");
    expect(formatWeekHours(45 * MINUTE + 59_000)).toBe("45m");
  });

  it("pads the minutes once there's an hour, as the prototype writes them", () => {
    expect(formatWeekHours(5 * HOUR + 45 * MINUTE)).toBe("5h 45m");
    expect(formatWeekHours(6 * HOUR + 5 * MINUTE)).toBe("6h 05m");
    expect(formatWeekHours(7 * HOUR)).toBe("7h 00m");
    expect(formatWeekHours(26 * HOUR + 1 * MINUTE)).toBe("26h 01m");
  });

  it("never shows a negative or broken figure", () => {
    expect(formatWeekHours(-5 * MINUTE)).toBe("0m");
    expect(formatWeekHours(Number.NaN)).toBe("0m");
    expect(formatWeekHours(Number.POSITIVE_INFINITY)).toBe("0m");
  });
});

describe("buildFriendRows", () => {
  const a = user("a", "Ana Lee");
  const b = user("b");
  const c = user("c", "Cy");

  it("keeps every friend in listFriends' order, zero-hour friends included", () => {
    const rows = buildFriendRows(
      [{ user: a }, { user: b }, { user: c }],
      // The week rows come in a different order, and b has none at all.
      [weekRow(c, 2 * HOUR), weekRow(a, 0)],
      []
    );
    expect(rows.map((r) => [r.userId, r.hours])).toEqual([
      ["a", "0m"],
      ["b", "0m"],
      ["c", "2h 00m"],
    ]);
    expect(rows[0]).toMatchObject({ username: "a", displayName: "Ana Lee", avatarUrl: null });
  });

  it("names this week's top goal first", () => {
    const [row] = buildFriendRows(
      [{ user: a }],
      [weekRow(a, HOUR, ["Pass the CFA", "Run"])],
      [
        { id: "a-old", userId: "a", title: "Oldest goal", isPrivate: false },
        { id: "a-g0", userId: "a", title: "Pass the CFA", isPrivate: false },
        { id: "a-g1", userId: "a", title: "Run", isPrivate: false },
      ]
    );
    expect(row.subline).toBe("Working on Pass the CFA");
  });

  // The week row's titles resolve every goal this week's sessions touched,
  // whatever its status: deleting a goal archives it.
  it("skips a week goal that's since been deleted, for the next one still active", () => {
    const rows = buildFriendRows(
      [{ user: a }, { user: b }],
      [weekRow(a, HOUR, ["Deleted goal", "Run"]), weekRow(b, HOUR, ["Also deleted"])],
      [
        { id: "a-old", userId: "a", title: "Oldest goal", isPrivate: false },
        { id: "a-g1", userId: "a", title: "Run", isPrivate: false },
        { id: "b-old", userId: "b", title: "B's oldest", isPrivate: false },
      ]
    );
    expect(rows[0].subline).toBe("Working on Run");
    // Nothing from the week is still active: the oldest shared goal.
    expect(rows[1].subline).toBe("Working on B's oldest");
  });

  it("falls back to their oldest shared active goal, then to no line", () => {
    const rows = buildFriendRows(
      [{ user: a }, { user: b }],
      [weekRow(a, 0), weekRow(b, 3 * HOUR)],
      [
        { id: "a-1", userId: "a", title: "  Learn Spanish ", isPrivate: false },
        { id: "a-2", userId: "a", title: "Second goal", isPrivate: false },
      ]
    );
    expect(rows[0].subline).toBe("Working on Learn Spanish");
    expect(rows[1].subline).toBeNull();
  });

  it("never names a private goal, even if one is handed over", () => {
    const rows = buildFriendRows(
      [{ user: a }, { user: b }],
      [weekRow(a, 0), weekRow(b, 0)],
      [
        { id: "a-1", userId: "a", title: "Secret", isPrivate: true },
        { id: "a-2", userId: "a", title: "Public", isPrivate: false },
        { id: "b-1", userId: "b", title: "Also secret", isPrivate: true },
      ]
    );
    expect(rows[0].subline).toBe("Working on Public");
    expect(rows[1].subline).toBeNull();
  });

  it("skips a blank title and moves on down the order", () => {
    const rows = buildFriendRows(
      [{ user: a }],
      [weekRow(a, HOUR, ["   "])],
      [
        { id: "a-g0", userId: "a", title: "   ", isPrivate: false },
        { id: "a-1", userId: "a", title: "", isPrivate: false },
        { id: "a-2", userId: "a", title: "Real goal", isPrivate: false },
      ]
    );
    expect(rows[0].subline).toBe("Working on Real goal");
  });

  // The hours on the rows are getFriendsWeekRows', measured over the
  // caller's own week. US clocks fall back on Sunday Nov 1 2026, so that
  // week runs 169 hours, and a session on each edge must land on the right
  // side of it.
  it("shows a DST week's hours by the caller's local boundaries", () => {
    const LA = "America/Los_Angeles";
    const at = (iso: string) => Date.parse(iso);
    const now = at("2026-11-02T07:59:00Z"); // Sun Nov 1, 11:59pm PST
    const span = (from: string, to: string): Session => ({
      id: `${from}`,
      categoryId: "c1",
      goalId: null,
      taskName: "t",
      startedAt: at(from),
      endedAt: at(to),
      pausedMs: 0,
      pausedSince: null,
      isPrivate: false,
      photoPath: null,
      autoEndedAt: null,
      autoEndReviewedAt: null,
      plannedWorkMs: null,
      workIntervalMs: null,
      breakMs: null,
      onBreak: false,
      breaksTaken: 0,
    } as Session);
    const friend = user("f");
    const sessions = new Map([
      [
        "f",
        [
          span("2026-10-26T06:00:00Z", "2026-10-26T06:45:00Z"), // Sun Oct 25 PDT: last week
          span("2026-10-26T07:30:00Z", "2026-10-26T08:00:00Z"), // Mon 12:30am PDT: 30m
          span("2026-11-02T07:00:00Z", "2026-11-02T07:45:00Z"), // Sun 11pm PST: 45m
        ],
      ],
    ]);
    const week = buildFriendsWeekRows(
      [{ user: friend, isMe: false }],
      sessions,
      new Map(),
      leaderboardWeekWindow(LA, now),
      now
    );
    const [row] = buildFriendRows([{ user: friend }], week, []);
    expect(row.hours).toBe("1h 15m");
  });
});

describe("friendVisibleGoals (listActiveGoalsForUsers' privacy rule)", () => {
  it("drops private goals and the viewer's own, keeping order", () => {
    const goals = [
      { userId: "f1", title: "one", isPrivate: false },
      { userId: "f1", title: "secret", isPrivate: true },
      { userId: "me", title: "mine", isPrivate: false },
      { userId: "me", title: "my secret", isPrivate: true },
      { userId: "f2", title: "two", isPrivate: false },
    ];
    expect(friendVisibleGoals(goals, "me").map((g) => g.title)).toEqual(["one", "two"]);
  });
});

describe("inviteGoalTitle", () => {
  it("is the oldest active goal that isn't private", () => {
    expect(
      inviteGoalTitle([
        { title: "Private one", isPrivate: true },
        { title: " Learn Spanish ", isPrivate: false },
        { title: "Later", isPrivate: false },
      ])
    ).toBe("Learn Spanish");
  });

  it("is null with none to name", () => {
    expect(inviteGoalTitle([])).toBeNull();
    expect(inviteGoalTitle([{ title: "Hidden", isPrivate: true }])).toBeNull();
  });
});

// ---- Relations and the overlay ---------------------------------------------------

const LEO = user("leo", "Leo Martins");
const NINA = user("nina", "Nina K");
const PRIYA = user("priya", "Priya Raman");
const ZACK = user("zack", "Zack Moore");
const DANIEL = user("daniel", "Daniel Kim");

const incoming: RequestEntry[] = [
  { requestId: "in-leo", user: LEO },
  { requestId: "in-nina", user: NINA },
];
const outgoing: RequestEntry[] = [{ requestId: "out-zack", user: ZACK }];
const blocked: BlockedEntry[] = [{ user: DANIEL }];
const relations = relationsFrom(["priya"], incoming, outgoing);

describe("relationsFrom", () => {
  it("is the page's reads in find-friends' shape", () => {
    expect(relations).toEqual({
      friendIds: ["priya"],
      incoming: [
        { requestId: "in-leo", userId: "leo" },
        { requestId: "in-nina", userId: "nina" },
      ],
      outgoing: [{ requestId: "out-zack", userId: "zack", username: "zack" }],
    });
  });
});

describe("tabRelation (search results and People on Progra, D12)", () => {
  it("maps each relationship to what the row offers", () => {
    expect(tabRelation(relations, NO_OVERLAY, "priya")).toEqual({ kind: "friends" });
    expect(tabRelation(relations, NO_OVERLAY, "leo")).toEqual({ kind: "accept", requestId: "in-leo" });
    expect(tabRelation(relations, NO_OVERLAY, "zack")).toEqual({ kind: "requested" });
    expect(tabRelation(relations, NO_OVERLAY, "stranger")).toEqual({ kind: "add" });
  });

  it("shows a tap at once: Add → Requested, Accept → Friends, Decline → Add", () => {
    const after = ops(
      { kind: "send", userId: "stranger" },
      { kind: "accept", requestId: "in-leo" },
      { kind: "decline", requestId: "in-nina" }
    );
    expect(tabRelation(relations, after, "stranger")).toEqual({ kind: "requested" });
    expect(tabRelation(relations, after, "leo")).toEqual({ kind: "friends" });
    expect(tabRelation(relations, after, "nina")).toEqual({ kind: "add" });
  });

  it("offers Add again once a request out is cancelled, even one just sent", () => {
    const cancelled = ops({ kind: "cancel", requestId: "out-zack", userId: "zack" });
    expect(tabRelation(relations, cancelled, "zack")).toEqual({ kind: "add" });
    const sentThenCancelled = ops(
      { kind: "send", userId: "stranger" },
      { kind: "cancel", requestId: "new-1", userId: "stranger" }
    );
    expect(tabRelation(relations, sentThenCancelled, "stranger")).toEqual({ kind: "add" });
  });

  it("lets a friendship win over a stale request", () => {
    const odd = relationsFrom(["leo"], incoming, []);
    expect(tabRelation(odd, NO_OVERLAY, "leo")).toEqual({ kind: "friends" });
  });
});

describe("applyFriendsTabOp", () => {
  it("records each tap once", () => {
    const o = ops(
      { kind: "send", userId: "x" },
      { kind: "send", userId: "x" },
      { kind: "unblock", userId: "daniel" }
    );
    expect(o.sent).toEqual(["x"]);
    expect(o.unblocked).toEqual(["daniel"]);
  });

  it("never changes the empty overlay itself", () => {
    applyFriendsTabOp(NO_OVERLAY, { kind: "send", userId: "x" });
    expect(NO_OVERLAY.sent).toEqual([]);
  });
});

describe("visible lists", () => {
  it("drops requests answered here", () => {
    const o = ops({ kind: "accept", requestId: "in-leo" });
    expect(visibleRequests(incoming, o).map((r) => r.requestId)).toEqual(["in-nina"]);
    const both = ops({ kind: "accept", requestId: "in-leo" }, { kind: "decline", requestId: "in-nina" });
    expect(visibleRequests(incoming, both)).toEqual([]);
  });

  it("drops a request taken back, and someone unblocked", () => {
    const o = ops(
      { kind: "cancel", requestId: "out-zack", userId: "zack" },
      { kind: "unblock", userId: "daniel" }
    );
    expect(visibleOutgoing(outgoing, o)).toEqual([]);
    expect(visibleBlocked(blocked, o)).toEqual([]);
    expect(visibleOutgoing(outgoing, NO_OVERLAY)).toEqual(outgoing);
    expect(visibleBlocked(blocked, NO_OVERLAY)).toEqual(blocked);
  });
});

describe("peopleOnProgra (D12)", () => {
  const suggested = [LEO, NINA, PRIYA, ZACK, user("ebrooks")];

  it("leaves out friends and anyone in Requests, keeps people asked", () => {
    expect(peopleOnProgra(suggested, relations, NO_OVERLAY).map((u) => u.userId)).toEqual([
      "zack",
      "ebrooks",
    ]);
  });

  it("follows the taps: an accept leaves, a decline joins", () => {
    const o = ops({ kind: "accept", requestId: "in-leo" }, { kind: "decline", requestId: "in-nina" });
    expect(peopleOnProgra(suggested, relations, o).map((u) => u.userId)).toEqual([
      "nina",
      "zack",
      "ebrooks",
    ]);
  });
});

describe("friendsTabSections (R:163-169)", () => {
  const counts = { requests: 2, friends: 3, people: 4, sent: 1, blocked: 1 };

  it("shows only the results while searching (R:164)", () => {
    expect(friendsTabSections({ searching: true, ...counts })).toEqual({
      invite: false,
      results: true,
      requests: false,
      uw: false,
      friends: false,
      friendsEmpty: false,
      people: false,
      sentBlocked: false,
    });
  });

  it("shows everything with something in it while browsing", () => {
    expect(friendsTabSections({ searching: false, ...counts })).toEqual({
      invite: true,
      results: false,
      requests: true,
      uw: false,
      friends: true,
      friendsEmpty: false,
      people: true,
      sentBlocked: true,
    });
  });

  it("keeps Your friends with its note, and hides the empty rest", () => {
    expect(
      friendsTabSections({ searching: false, requests: 0, friends: 0, people: 0, sent: 0, blocked: 0 })
    ).toEqual({
      invite: true,
      results: false,
      requests: false,
      uw: false,
      friends: true,
      friendsEmpty: true,
      people: false,
      sentBlocked: false,
    });
  });

  it("shows the Sent · Blocked row when either list has someone", () => {
    const base = { searching: false, requests: 0, friends: 1, people: 0 };
    expect(friendsTabSections({ ...base, sent: 1, blocked: 0 }).sentBlocked).toBe(true);
    expect(friendsTabSections({ ...base, sent: 0, blocked: 1 }).sentBlocked).toBe(true);
  });

  it("puts a UW student's groups in place of People on Progra (R:168, D12)", () => {
    const uw = friendsTabSections({ searching: false, uwGroups: 2, ...counts });
    expect(uw).toMatchObject({ requests: true, uw: true, friends: true, people: false });
  });

  it("brings People on Progra back once the groups have nobody left", () => {
    expect(friendsTabSections({ searching: false, uwGroups: 0, ...counts })).toMatchObject({
      uw: false,
      people: true,
    });
  });

  it("hides the UW groups while searching, like every other section (R:164)", () => {
    expect(friendsTabSections({ searching: true, uwGroups: 3, ...counts }).uw).toBe(false);
  });
});
