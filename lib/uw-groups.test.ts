import { describe, expect, it } from "vitest";

import { NO_RELATIONS, type FriendRelations } from "@/lib/find-friends";
import { NO_OVERLAY, applyFriendsTabOp } from "@/lib/friends-tab";
import { FIND_FRIENDS_COPY } from "@/lib/onboarding-v3";
import {
  NO_PAGING,
  UW_BUCKET_FOR,
  UW_GROUPS_COPY,
  findFriendsView,
  friendsTabUw,
  friendsTabUwHide,
  keepEveryone,
  mergeUwPage,
  sameCursor,
  sameMajorTitle,
  uwFetchKey,
  uwGroupPeers,
  uwGroupTitle,
  uwGroupsEmpty,
  uwNextCursor,
  uwSections,
  uwSubline,
  type UwPaging,
} from "@/lib/uw-groups";
import {
  UW_GROUP_KEY,
  emptyUwPeerGroups,
  type UwGroupPeer,
  type UwPeerCursor,
  type UwPeerGroups,
} from "@/lib/uw-peers";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Row n's place in its group, and the cursor after it: a lower n is newer,
// so it sorts first, as (onboarded_at desc, id desc) does.
const cursor = (n: number): UwPeerCursor => ({
  ts: `2026-10-01T12:00:${String(59 - n).padStart(2, "0")}.123456+00:00`,
  id: uuid(n),
});

function peer(n: number, over: Partial<UwGroupPeer> = {}): UwGroupPeer {
  return {
    userId: uuid(n),
    username: `peer${n}`,
    displayName: `Peer ${n}`,
    avatarUrl: null,
    matched: null,
    major: null,
    onboardedAt: cursor(n).ts,
    ...over,
  };
}

function groups(over: Partial<UwPeerGroups> = {}): UwPeerGroups {
  return { ...emptyUwPeerGroups(), ...over };
}

// A "More at UW" of `n` rows from `from`, with the whole group's total and a
// cursor after its last row when `more`.
function restGroup(from: number, n: number, total: number, more: boolean): UwPeerGroups {
  const rest = Array.from({ length: n }, (_, i) => peer(from + i, { major: "Biology" }));
  return groups({
    rest,
    totals: { sameMajor: 0, sharedInterest: 0, rest: total },
    cursors: { sameMajor: null, sharedInterest: null, rest: more ? cursor(from + n - 1) : null },
  });
}

describe("group titles (R:137-139)", () => {
  it("names the viewer's major", () => {
    expect(sameMajorTitle(["Economics"])).toBe("In Economics");
  });

  it("joins a double or triple major with ' & ', all of them, in order", () => {
    expect(sameMajorTitle(["Economics", "Computer Science"])).toBe(
      "In Economics & Computer Science"
    );
    expect(sameMajorTitle(["Physics", "Mathematics", "Philosophy"])).toBe(
      "In Physics & Mathematics & Philosophy"
    );
  });

  it("uses the stored spelling: a list entry canonical, duplicates once", () => {
    expect(sameMajorTitle(["computer   science", "Computer Science", " Economics "])).toBe(
      "In Computer Science & Economics"
    );
    // Free text is kept as typed (tidied).
    expect(sameMajorTitle(["Comparative History of Ideas"])).toBe(
      "In Comparative History of Ideas"
    );
  });

  it("falls back to the rows' matched majors, then to a plain title", () => {
    const rows = [{ matched: "Economics" }, { matched: "economics" }, { matched: "Physics" }];
    expect(sameMajorTitle([], rows)).toBe("In Economics & Physics");
    expect(sameMajorTitle([], [{ matched: null }])).toBe(UW_GROUPS_COPY.majorFallback);
    expect(sameMajorTitle([])).toBe(UW_GROUPS_COPY.majorFallback);
  });

  it("titles the other two groups as R does", () => {
    expect(uwGroupTitle("sharedInterest", ["Economics"])).toBe("Shares your interests");
    expect(uwGroupTitle("rest", ["Economics"])).toBe("More at UW");
    expect(uwGroupTitle("sameMajor", ["Economics"])).toBe("In Economics");
  });
});

describe("uwSubline (R:137-139)", () => {
  it("says the matched major in the major group, in secondary ink", () => {
    expect(uwSubline("sameMajor", { matched: "Economics", major: null })).toEqual({
      text: "Also studying Economics",
      tone: "secondary",
    });
  });

  it("says the matched interest in the interest group, in secondary ink", () => {
    expect(uwSubline("sharedInterest", { matched: "Running", major: null })).toEqual({
      text: "Also into Running",
      tone: "secondary",
    });
  });

  it("gives More at UW the peer's listed major, faint, and never a match", () => {
    expect(uwSubline("rest", { matched: "Economics", major: "Biology" })).toEqual({
      text: "Biology",
      tone: "faint",
    });
    // uwPeerFromRow nulls a typed major, so there's nothing to say.
    expect(uwSubline("rest", { matched: null, major: null })).toEqual({ text: null, tone: "faint" });
  });

  it("has no line for a match row with no match string", () => {
    expect(uwSubline("sameMajor", { matched: null, major: "Biology" }).text).toBeNull();
    expect(uwSubline("sharedInterest", { matched: "  ", major: null }).text).toBeNull();
  });
});

describe("paging: merge and dedupe", () => {
  const base = [peer(1), peer(2), peer(3)];

  it("asks after the first page, then after what's been paged in", () => {
    const g = restGroup(1, 3, 6, true);
    expect(uwNextCursor(g, NO_PAGING, "rest")).toEqual(cursor(3));
    const paged = mergeUwPage(
      NO_PAGING,
      "rest",
      { after: cursor(3), base: g.rest },
      { peers: [peer(4), peer(5)], total: 6, cursor: cursor(5) }
    );
    expect(uwNextCursor(g, paged, "rest")).toEqual(cursor(5));
    expect(uwNextCursor(g, NO_PAGING, "sameMajor")).toBeNull();
  });

  it("keeps the first page as it was asked from, then each page after it", () => {
    const paged = mergeUwPage(
      NO_PAGING,
      "rest",
      { after: cursor(3), base },
      { peers: [peer(4)], total: 5, cursor: cursor(4) }
    );
    expect(paged.rest?.peers.map((p) => p.userId)).toEqual([1, 2, 3, 4].map(uuid));
    const again = mergeUwPage(
      paged,
      "rest",
      { after: cursor(4), base: [] },
      { peers: [peer(5)], total: 5, cursor: null }
    );
    expect(again.rest?.peers.map((p) => p.userId)).toEqual([1, 2, 3, 4, 5].map(uuid));
    expect(again.rest?.cursor).toBeNull();
  });

  it("drops a reply for a cursor the group has moved past, or once it's done", () => {
    const paged: UwPaging = { rest: { peers: [...base, peer(4)], cursor: cursor(4) } };
    // A duplicate of the first ask, landing after it.
    const late = mergeUwPage(
      paged,
      "rest",
      { after: cursor(3), base },
      { peers: [peer(4)], total: 9, cursor: cursor(4) }
    );
    expect(late).toBe(paged);
    const done: UwPaging = { rest: { peers: base, cursor: null } };
    expect(
      mergeUwPage(done, "rest", { after: cursor(3), base }, { peers: [peer(9)], total: 9, cursor: null })
    ).toBe(done);
  });

  it("lists the fresh first page first, then what was paged in, each person once", () => {
    const more = { peers: [peer(1), peer(2), peer(3), peer(4), peer(6)], cursor: null };
    // A refresh: someone newly listed at the top (0), and 5 on a later page.
    const fresh = [peer(0), peer(1), peer(2), peer(3), peer(4)];
    expect(uwGroupPeers(fresh, more, cursor(4)).map((p) => p.userId)).toEqual(
      [0, 1, 2, 3, 4, 6].map(uuid)
    );
    expect(uwGroupPeers(fresh, undefined, cursor(4)).map((p) => p.userId)).toEqual(
      [0, 1, 2, 3, 4].map(uuid)
    );
  });

  it("drops a paged-in row the fresh first page covers but no longer lists", () => {
    // Page two (4-5) was loaded after a first page of 1-3. Since then 2
    // unlisted themselves (or blocked the viewer, or left the cohort), so the
    // fresh first page runs 1, 3, 4. 2 sorts inside it: the server left them
    // out. 5 sorts below it, where the server may have pushed it: kept.
    const paged = mergeUwPage(
      NO_PAGING,
      "rest",
      { after: cursor(3), base: [peer(1), peer(2), peer(3)] },
      { peers: [peer(4), peer(5)], total: 5, cursor: cursor(5) }
    );
    const shown = uwGroupPeers([peer(1), peer(3), peer(4)], paged.rest, cursor(4));
    expect(shown.map((p) => p.userId)).toEqual([1, 3, 4, 5].map(uuid));
  });

  it("drops every paged-in row a first page with no cursor lacks: it's the whole group", () => {
    const more = { peers: [peer(1), peer(2), peer(3), peer(4)], cursor: null };
    expect(uwGroupPeers([peer(1), peer(3)], more, null).map((p) => p.userId)).toEqual(
      [1, 3].map(uuid)
    );
    expect(uwGroupPeers([], more, null)).toEqual([]);
  });

  it("keeps a paged-in row whose place it can't read, unless the first page is everyone", () => {
    const odd = peer(2, { onboardedAt: null });
    const more = { peers: [peer(1), odd], cursor: null };
    expect(uwGroupPeers([peer(1)], more, cursor(1)).map((p) => p.userId)).toEqual(
      [1, 2].map(uuid)
    );
    expect(uwGroupPeers([peer(1)], more, null).map((p) => p.userId)).toEqual([uuid(1)]);
  });

  it("drops a row the fresh first page covers from the sections and their count", () => {
    // Fresh: 1 and 3 (total 4, 2 having unlisted), cursor after 3; paged in
    // before: 1-3, then 4.
    const fresh = groups({
      rest: [peer(1), peer(3)],
      totals: { sameMajor: 0, sharedInterest: 0, rest: 3 },
      cursors: { sameMajor: null, sharedInterest: null, rest: cursor(3) },
    });
    const paging: UwPaging = { rest: { peers: [1, 2, 3, 4].map((n) => peer(n)), cursor: null } };
    const [rest] = uwSections({ groups: fresh, majors: [], paging });
    expect(rest.peers.map((p) => p.userId)).toEqual([1, 3, 4].map(uuid));
    expect(rest.count).toBe(3);
  });

  it("keeps a row the fresh first page pushed onto page two (the snapshot)", () => {
    // Asked after row 3; meanwhile row 0 joined, so the fresh first page ends
    // at row 2 and row 3 is in neither it nor the page fetched after it.
    const paged = mergeUwPage(
      NO_PAGING,
      "rest",
      { after: cursor(3), base: [peer(1), peer(2), peer(3)] },
      { peers: [peer(4)], total: 5, cursor: null }
    );
    const shown = uwGroupPeers([peer(0), peer(1), peer(2)], paged.rest, cursor(2));
    expect(shown.map((p) => p.userId)).toEqual([0, 1, 2, 3, 4].map(uuid));
  });

  it("compares cursors by value", () => {
    expect(sameCursor(cursor(1), { ...cursor(1) })).toBe(true);
    expect(sameCursor(cursor(1), cursor(2))).toBe(false);
    expect(sameCursor(null, null)).toBe(true);
    expect(sameCursor(cursor(1), null)).toBe(false);
  });

  it("maps every group key back to its bucket", () => {
    for (const [bucket, key] of Object.entries(UW_GROUP_KEY)) {
      expect(UW_BUCKET_FOR[key]).toBe(bucket);
    }
  });
});

describe("uwSections", () => {
  const three = groups({
    sameMajor: [peer(1, { matched: "Economics" })],
    sharedInterest: [peer(2, { matched: "Running" }), peer(3, { matched: "Startups" })],
    rest: [peer(4, { major: "Biology" })],
    totals: { sameMajor: 1, sharedInterest: 2, rest: 30 },
    cursors: { sameMajor: null, sharedInterest: null, rest: cursor(4) },
  });

  it("lists the three groups in R's order, with titles and whole-group counts", () => {
    const s = uwSections({ groups: three, majors: ["Economics", "Computer Science"] });
    expect(s.map((x) => [x.key, x.title, x.count, x.peers.length])).toEqual([
      ["sameMajor", "In Economics & Computer Science", 1, 1],
      ["sharedInterest", "Shares your interests", 2, 2],
      ["rest", "More at UW", 30, 1],
    ]);
    expect(s[2].cursor).toEqual(cursor(4));
    expect(s[2].bucket).toBe("rest");
  });

  it("leaves out a group with nobody in it and nothing more to load (P:1151-1153)", () => {
    const s = uwSections({ groups: groups({ rest: [peer(1)], totals: { sameMajor: 0, sharedInterest: 0, rest: 1 } }), majors: [] });
    expect(s.map((x) => x.key)).toEqual(["rest"]);
    expect(uwSections({ groups: emptyUwPeerGroups(), majors: ["Economics"] })).toEqual([]);
  });

  it("lists a person once, in the first group that has them", () => {
    const dup = groups({
      sameMajor: [peer(1)],
      rest: [peer(1), peer(2)],
      totals: { sameMajor: 1, sharedInterest: 0, rest: 2 },
    });
    const s = uwSections({ groups: dup, majors: ["Economics"] });
    expect(s.map((x) => x.peers.map((p) => p.userId))).toEqual([[uuid(1)], [uuid(2)]]);
  });

  it("never counts fewer than it lists", () => {
    const short = groups({ rest: [peer(1), peer(2)], totals: { sameMajor: 0, sharedInterest: 0, rest: 1 } });
    expect(uwSections({ groups: short, majors: [] })[0].count).toBe(2);
  });

  it("merges the pages paged in", () => {
    const g = restGroup(1, 2, 4, true);
    const paging: UwPaging = {
      rest: { peers: [peer(1), peer(2), peer(3), peer(4)], cursor: null },
    };
    const [rest] = uwSections({ groups: g, majors: [], paging });
    expect(rest.peers.map((p) => p.userId)).toEqual([1, 2, 3, 4].map(uuid));
    expect(rest.cursor).toBeNull();
  });
});

describe("added: stays on Screen 5, leaves the Friends tab", () => {
  const g = restGroup(1, 3, 3, false);

  it("Screen 5 keeps everyone (P:1199-1200)", () => {
    expect(keepEveryone()).toBeNull();
    const [rest] = uwSections({ groups: g, majors: [] });
    expect(rest.peers).toHaveLength(3);
    expect(rest.count).toBe(3);
  });

  it("the Friends tab takes a just-asked person out at once, and off the count (P:1294)", () => {
    const overlay = applyFriendsTabOp(NO_OVERLAY, { kind: "send", userId: uuid(2) });
    const hide = friendsTabUwHide(NO_RELATIONS, overlay);
    expect(hide(peer(2))).toBe("pending");
    expect(hide(peer(1))).toBeNull();
    const [rest] = uwSections({ groups: g, majors: [], hide });
    expect(rest.peers.map((p) => p.userId)).toEqual([uuid(1), uuid(3)]);
    expect(rest.count).toBe(2);
  });

  it("keeps them out once the page knows, from a page the server no longer lists them on", () => {
    const relations: FriendRelations = {
      friendIds: [uuid(5)],
      outgoing: [{ requestId: "r-6", userId: uuid(6), username: "peer6" }],
      incoming: [{ requestId: "r-7", userId: uuid(7) }],
    };
    const hide = friendsTabUwHide(relations, NO_OVERLAY);
    for (const n of [5, 6, 7]) expect(hide(peer(n))).toBe("settled");
    // A refreshed first page (1-3, total 4, the RPC having left 5-7 out) and
    // a page loaded before they were connected (4-7).
    const fresh = restGroup(1, 3, 4, true);
    const paging: UwPaging = {
      rest: { peers: [1, 2, 3, 4, 5, 6, 7].map((n) => peer(n)), cursor: null },
    };
    const [rest] = uwSections({ groups: fresh, majors: [], paging, hide });
    expect(rest.peers.map((p) => p.userId)).toEqual([1, 2, 3, 4].map(uuid));
    // Not taken off a total that already left them out.
    expect(rest.count).toBe(4);
  });

  it("takes off the count someone the first page still lists, whatever the reason", () => {
    const relations: FriendRelations = {
      friendIds: [uuid(1)],
      outgoing: [],
      incoming: [],
    };
    const [rest] = uwSections({
      groups: restGroup(1, 3, 3, false),
      majors: [],
      hide: friendsTabUwHide(relations, NO_OVERLAY),
    });
    expect(rest.count).toBe(2);
  });

  it("takes out someone the viewer has blocked, from a page that never refreshes", () => {
    const hide = friendsTabUwHide(NO_RELATIONS, NO_OVERLAY, new Set([uuid(4)]));
    expect(hide(peer(4))).toBe("settled");
    expect(hide(peer(3))).toBeNull();
    // First page 1-3 (total 4, the RPC leaving 4 out); 4 paged in before.
    const fresh = restGroup(1, 3, 4, true);
    const paging: UwPaging = { rest: { peers: [1, 2, 3, 4].map((n) => peer(n)), cursor: null } };
    const [rest] = uwSections({ groups: fresh, majors: [], paging, hide });
    expect(rest.peers.map((p) => p.userId)).toEqual([1, 2, 3].map(uuid));
    expect(rest.count).toBe(4);
  });

  it("puts someone back when their request is taken back from the sheet", () => {
    const relations: FriendRelations = {
      friendIds: [],
      outgoing: [{ requestId: "r-2", userId: uuid(2), username: "peer2" }],
      incoming: [],
    };
    const overlay = applyFriendsTabOp(NO_OVERLAY, {
      kind: "cancel",
      requestId: "r-2",
      userId: uuid(2),
    });
    expect(friendsTabUwHide(relations, overlay)(peer(2))).toBeNull();
    expect(friendsTabUwHide(relations, NO_OVERLAY)(peer(2))).toBe("settled");
  });

  it("drops a group whose every listed person was added, unless it has more to load", () => {
    const one = restGroup(1, 1, 1, false);
    const overlay = applyFriendsTabOp(NO_OVERLAY, { kind: "send", userId: uuid(1) });
    const hide = friendsTabUwHide(NO_RELATIONS, overlay);
    expect(uwSections({ groups: one, majors: [], hide })).toEqual([]);
    const more = restGroup(1, 1, 5, true);
    const [rest] = uwSections({ groups: more, majors: [], hide });
    expect(rest.peers).toEqual([]);
    expect(rest.count).toBe(4);
  });
});

describe("Screen 5's layout (R:131, R:141)", () => {
  const someone = groups({ rest: [peer(1)], totals: { sameMajor: 0, sharedInterest: 0, rest: 1 } });

  it("is the non-UW screen for anyone who isn't a UW student here", () => {
    expect(findFriendsView(null)).toEqual({
      list: "preview",
      sub: FIND_FRIENDS_COPY.sub,
      note: FIND_FRIENDS_COPY.note,
    });
  });

  it("waits under the plain subtitle, so it never claims UW people and takes it back", () => {
    expect(findFriendsView({ status: "loading" })).toEqual({
      list: "loading",
      sub: FIND_FRIENDS_COPY.sub,
    });
  });

  it("shows the groups under the UW subtitle", () => {
    expect(findFriendsView({ status: "ready", groups: someone })).toEqual({
      list: "groups",
      sub: FIND_FRIENDS_COPY.uwSub,
    });
  });

  it("says 'You're early' over the preview when nobody's there, without the UW subtitle", () => {
    expect(findFriendsView({ status: "ready", groups: emptyUwPeerGroups() })).toEqual({
      list: "preview",
      sub: FIND_FRIENDS_COPY.sub,
      note: FIND_FRIENDS_COPY.early,
    });
  });

  it("falls back to the non-UW screen whole when the fetch failed", () => {
    expect(findFriendsView({ status: "failed" })).toEqual(findFriendsView(null));
  });

  it("calls a read empty only when every group is", () => {
    expect(uwGroupsEmpty(emptyUwPeerGroups())).toBe(true);
    expect(uwGroupsEmpty(someone)).toBe(false);
    expect(uwGroupsEmpty(groups({ sameMajor: [peer(1)] }))).toBe(false);
  });

  it("counts people for a screen reader in the singular and plural", () => {
    expect(UW_GROUPS_COPY.people(1)).toBe("1 person");
    expect(UW_GROUPS_COPY.people(12)).toBe("12 people");
    expect(UW_GROUPS_COPY.found(1)).toBe("1 person from UW");
    expect(UW_GROUPS_COPY.found(3)).toBe("3 people from UW");
  });

  it("uses R's words exactly, and says every suggestion is from UW", () => {
    expect(FIND_FRIENDS_COPY.uwSub).toBe(
      "Your feed is your friends clocking in. Everyone suggested below is a UW student."
    );
    expect(FIND_FRIENDS_COPY.early).toBe(
      "You’re early. No one from UW is on Progra yet. Send your link and they’ll show up here."
    );
  });
});

describe("uwFetchKey", () => {
  it("is null for anyone who isn't a UW student here", () => {
    expect(uwFetchKey(null)).toBeNull();
  });

  it("is the same for the same answer, however it's spelled", () => {
    const a = uwFetchKey({ majors: ["Economics"], interests: ["Running"] });
    expect(uwFetchKey({ majors: [" economics "], interests: ["running"] })).toBe(a);
    expect(uwFetchKey({ majors: ["Economics", "economics"], interests: ["Running"] })).toBe(a);
  });

  it("changes when the answer does, so Screen 5 fetches again", () => {
    const a = uwFetchKey({ majors: ["Economics"], interests: [] });
    expect(uwFetchKey({ majors: ["Physics"], interests: [] })).not.toBe(a);
    expect(uwFetchKey({ majors: ["Economics"], interests: ["Chess"] })).not.toBe(a);
    // A Yes with nothing picked still fetches: "More at UW" needs no match.
    expect(uwFetchKey({ majors: [], interests: [] })).not.toBeNull();
  });
});

describe("friendsTabUw", () => {
  const g = restGroup(1, 1, 1, false);

  it("hands the tab the groups and the viewer's majors for a UW student", () => {
    expect(friendsTabUw({ is_uw: true, uw_majors: ["computer science"] }, g)).toEqual({
      groups: g,
      majors: ["Computer Science"],
    });
    expect(friendsTabUw({ is_uw: true, uw_majors: null }, g)?.majors).toEqual([]);
  });

  it("is null outside the cohort or without a profile", () => {
    expect(friendsTabUw({ is_uw: false, uw_majors: ["Economics"] }, g)).toBeNull();
    expect(friendsTabUw({}, g)).toBeNull();
    expect(friendsTabUw(null, g)).toBeNull();
    expect(friendsTabUw({ is_uw: false }, null)).toBeNull();
  });

  it("tells a failed read apart from being outside the cohort", () => {
    expect(friendsTabUw({ is_uw: true, uw_majors: ["Economics"] }, null)).toEqual({
      groups: null,
      majors: ["Economics"],
    });
  });
});
