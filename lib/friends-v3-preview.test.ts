import { describe, expect, it } from "vitest";

import { NO_OVERLAY, peopleOnProgra, relationsFrom, tabRelation } from "@/lib/friends-tab";
import {
  FRIENDS_PREVIEW_FIXTURES,
  applyPreviewWrite,
  createFriendsPreviewServices,
  fakeFriendsSearch,
  friendsPreviewData,
  friendsPreviewStart,
  parseFriendsPreviewParams,
  type FriendsPreviewWrite,
} from "@/lib/friends-v3-preview";
import { checkUsername } from "@/lib/social/username";
import { uwSections } from "@/lib/uw-groups";

describe("parseFriendsPreviewParams", () => {
  it("takes a known fixture, and falls back to default", () => {
    for (const f of FRIENDS_PREVIEW_FIXTURES) {
      expect(parseFriendsPreviewParams({ fixture: f }).fixture).toBe(f);
    }
    expect(parseFriendsPreviewParams({}).fixture).toBe("default");
    expect(parseFriendsPreviewParams({ fixture: "nope" }).fixture).toBe("default");
    expect(parseFriendsPreviewParams({ fixture: ["sheet", "empty"] }).fixture).toBe("sheet");
  });

  it("opens search typed, or the sheet, for those fixtures only", () => {
    expect(friendsPreviewStart("search")).toEqual({ query: "pri", sheetOpen: false });
    expect(friendsPreviewStart("sheet")).toEqual({ sheetOpen: true });
    expect(friendsPreviewStart("default")).toEqual({ sheetOpen: false });
  });
});

describe("fixtures", () => {
  it("default: two requests, three friends incl. one at 0m and one with no line", () => {
    const d = friendsPreviewData("default");
    expect(d.incoming.map((r) => r.user.username)).toEqual(["leo_m", "nina_k"]);
    expect(d.friends.map((f) => [f.username, f.subline, f.hours])).toEqual([
      ["priyaraman", "Working on Pass the CFA Level I", "9h 10m"],
      ["marcuslee", "Working on Ship my portfolio site", "0m"],
      ["sofia_alv", null, "7h 45m"],
    ]);
    expect(d.outgoing.length + d.blocked.length).toBeGreaterThan(0);
    const relations = relationsFrom(d.friends.map((f) => f.userId), d.incoming, d.outgoing);
    expect(peopleOnProgra(d.suggested, relations, NO_OVERLAY).length).toBeGreaterThan(0);
  });

  it("empty: no friends, no requests, nothing out or blocked", () => {
    const d = friendsPreviewData("empty");
    expect([d.friends, d.incoming, d.outgoing, d.blocked].every((l) => l.length === 0)).toBe(true);
  });

  it("search: 'pri' finds a friend, a request out and a stranger", () => {
    const d = friendsPreviewData("search");
    const relations = relationsFrom(d.friends.map((f) => f.userId), d.incoming, d.outgoing);
    const found = fakeFriendsSearch(friendsPreviewStart("search").query);
    const kinds = found.results.map((p) => tabRelation(relations, NO_OVERLAY, p.userId).kind);
    expect(new Set(kinds)).toEqual(new Set(["friends", "requested", "add"]));
  });

  it("uses handles the app would accept", () => {
    const d = friendsPreviewData("default");
    const handles = [
      ...d.friends.map((f) => f.username),
      ...d.incoming.map((r) => r.user.username),
      ...d.outgoing.map((r) => r.user.username),
      ...d.blocked.map((b) => b.user.username),
      ...d.suggested.map((u) => u.username),
    ];
    for (const h of handles) expect(checkUsername(h).ok).toBe(true);
  });
});

describe("fakeFriendsSearch", () => {
  it("follows searchUsers' contract: '@' ignored, two characters, five at most", () => {
    expect(fakeFriendsSearch("p").results).toEqual([]);
    expect(fakeFriendsSearch(42).results).toEqual([]);
    expect(fakeFriendsSearch("@pri").results.map((p) => p.username)).toEqual(
      fakeFriendsSearch("pri").results.map((p) => p.username)
    );
    expect(fakeFriendsSearch("pri").results.length).toBeLessThanOrEqual(5);
  });

  it("never finds the blocked person", () => {
    expect(fakeFriendsSearch("dkim").results).toEqual([]);
  });
});

describe("applyPreviewWrite (the preview's stand-in for revalidation)", () => {
  const d = friendsPreviewData("default");

  it("accept moves the requester into friends, at 0m with no line", () => {
    const next = applyPreviewWrite(d, { kind: "accept", requestId: "preview-request-leo" });
    expect(next.incoming.map((r) => r.user.username)).toEqual(["nina_k"]);
    expect(next.friends[0]).toMatchObject({ username: "leo_m", subline: null, hours: "0m" });
    expect(next.friends).toHaveLength(d.friends.length + 1);
  });

  it("remove deletes a pending row either way; unblock empties Blocked", () => {
    const declined = applyPreviewWrite(d, { kind: "remove", requestId: "preview-request-nina" });
    expect(declined.incoming.map((r) => r.user.username)).toEqual(["leo_m"]);
    const cancelled = applyPreviewWrite(d, { kind: "remove", requestId: "preview-request-priyanka" });
    expect(cancelled.outgoing).toEqual([]);
    const unblocked = applyPreviewWrite(d, { kind: "unblock", userId: d.blocked[0].user.userId });
    expect(unblocked.blocked).toEqual([]);
  });

  it("send adds a request out, once", () => {
    const zack = d.suggested.find((u) => u.username === "zackmoore");
    expect(zack).toBeDefined();
    const sent = applyPreviewWrite(d, { kind: "send", userId: zack!.userId, requestId: "r1" });
    expect(sent.outgoing[0]).toEqual({ requestId: "r1", user: zack });
    expect(applyPreviewWrite(sent, { kind: "send", userId: zack!.userId, requestId: "r2" })).toBe(sent);
  });

  it("ignores a write for someone it doesn't know", () => {
    expect(applyPreviewWrite(d, { kind: "accept", requestId: "nope" })).toBe(d);
    expect(applyPreviewWrite(d, { kind: "send", userId: "nope", requestId: "r" })).toBe(d);
  });
});

describe("createFriendsPreviewServices", () => {
  it("writes to the preview's copy just before answering, and sends nothing", async () => {
    const writes: FriendsPreviewWrite[] = [];
    const s = createFriendsPreviewServices((w) => writes.push(w), 0);
    const sent = await s.sendFriendRequest("u1");
    expect(sent).toMatchObject({ ok: true });
    expect(await s.acceptFriendRequest("in")).toEqual({ ok: true });
    expect(await s.cancelFriendRequest("out")).toEqual({ ok: true });
    expect(await s.unblockUser("b")).toEqual({ ok: true });
    expect(await s.shareInvite("hi")).toBe("shared");
    expect(writes.map((w) => w.kind)).toEqual(["send", "accept", "remove", "unblock"]);
  });
});

describe("the uw fixture (P9d)", () => {
  const d = friendsPreviewData("uw");

  it("is the default world plus a UW student's three groups", () => {
    const def = friendsPreviewData("default");
    expect(d.incoming).toEqual(def.incoming);
    expect(d.friends).toEqual(def.friends);
    expect(def.uw).toBeNull();
    expect(friendsPreviewData("empty").uw).toBeNull();
    expect(d.uw?.majors).toEqual(["Economics", "Computer Science"]);
    const sections = uwSections({ groups: d.uw!.groups!, majors: d.uw!.majors });
    expect(sections.map((s) => s.title)).toEqual([
      "In Economics & Computer Science",
      "Shares your interests",
      "More at UW",
    ]);
    // More at UW is longer than a page, so it has a next one to load.
    expect(sections[2].cursor).not.toBeNull();
  });

  it("gives the groups' people handles the app would accept", () => {
    const g = d.uw!.groups!;
    for (const p of [...g.sameMajor, ...g.sharedInterest, ...g.rest]) {
      expect(checkUsername(p.username).ok).toBe(true);
    }
  });

  it("an Add to a UW student sends a request, and the reread groups leave them out", () => {
    const aisha = d.uw!.groups!.sameMajor[0];
    const sent = applyPreviewWrite(d, { kind: "send", userId: aisha.userId, requestId: "r-uw" });
    expect(sent.outgoing[0]).toMatchObject({ requestId: "r-uw", user: { userId: aisha.userId } });
    expect(sent.uw!.groups!.sameMajor.some((p) => p.userId === aisha.userId)).toBe(false);
    expect(sent.uw!.groups!.totals.sameMajor).toBe(d.uw!.groups!.totals.sameMajor - 1);
    // Taken back from the sheet: back in their group.
    const back = applyPreviewWrite(sent, { kind: "remove", requestId: "r-uw" });
    expect(back.uw!.groups!.sameMajor.map((p) => p.userId)).toEqual(
      d.uw!.groups!.sameMajor.map((p) => p.userId)
    );
  });

  it("pages More at UW through the fake, and refuses a bad cursor as the action does", async () => {
    const s = createFriendsPreviewServices(() => {}, 0);
    const after = d.uw!.groups!.cursors.rest!;
    const r = await s.fetchMoreUwPeers("rest", after);
    expect("page" in r && r.page.peers.length).toBeGreaterThan(0);
    expect(await s.fetchMoreUwPeers("rest", { ts: "yesterday", id: "x" })).toEqual({
      error: "Couldn't load more UW students.",
    });
  });
});
