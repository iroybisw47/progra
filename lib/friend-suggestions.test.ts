import { describe, expect, it } from "vitest";

import type { FriendSuggestion } from "@/lib/db/friends";
import { SUGGESTIONS_COPY, friendsTabSuggestions } from "@/lib/friend-suggestions";
import { emptyUwPeerGroups } from "@/lib/uw-peers";
import type { UwGroupPeer, UwPeerGroups } from "@/lib/uw-peers";

const peer = (id: string, over: Partial<UwGroupPeer> = {}): UwGroupPeer => ({
  userId: id,
  username: `u${id}`,
  displayName: null,
  avatarUrl: null,
  matched: null,
  major: null,
  onboardedAt: null,
  ...over,
});

const groups = (over: Partial<UwPeerGroups>): UwPeerGroups => ({ ...emptyUwPeerGroups(), ...over });

const fof = (id: string, mutualCount: number): FriendSuggestion => ({
  userId: id,
  username: `u${id}`,
  displayName: null,
  bio: "bio",
  avatarUrl: null,
  mutualCount,
});

const ids = (rows: { user: { userId: string } }[]) => rows.map((r) => r.user.userId);
const NONE = new Set<string>();

describe("friendsTabSuggestions", () => {
  it("UW: same major then shared interests are Suggested; the rest is Other people at UW", () => {
    const out = friendsTabSuggestions(
      {
        kind: "uw",
        groups: groups({
          sameMajor: [peer("a", { matched: "Computer Science" })],
          sharedInterest: [peer("b", { matched: "Running" })],
          rest: [peer("c", { major: "Economics" }), peer("d")],
        }),
      },
      NONE
    );
    expect(ids(out.suggested)).toEqual(["a", "b"]);
    expect(out.suggested.map((r) => r.subline)).toEqual([
      "Also studying Computer Science",
      "Also into Running",
    ]);
    expect(ids(out.otherUw)).toEqual(["c", "d"]);
    expect(out.otherUw.map((r) => r.subline)).toEqual(["Economics", null]);
    expect([...out.hideFromPeople].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("UW with a failed read shows nothing", () => {
    const out = friendsTabSuggestions({ kind: "uw", groups: null }, NONE);
    expect(out.suggested).toEqual([]);
    expect(out.otherUw).toEqual([]);
    expect(out.hideFromPeople.size).toBe(0);
  });

  it("non-UW: friends of friends, in order, with a mutual-friend line", () => {
    const out = friendsTabSuggestions({ kind: "fof", people: [fof("x", 3), fof("y", 1)] }, NONE);
    expect(ids(out.suggested)).toEqual(["x", "y"]);
    expect(out.suggested.map((r) => r.subline)).toEqual(["3 mutual friends", "1 mutual friend"]);
    expect(out.otherUw).toEqual([]);
    // Only the public identity goes to the row, not the bio.
    expect(Object.keys(out.suggested[0].user).sort()).toEqual([
      "avatarUrl",
      "displayName",
      "userId",
      "username",
    ]);
  });

  it("drops current friends and lists each person once", () => {
    const out = friendsTabSuggestions(
      {
        kind: "uw",
        groups: groups({
          sameMajor: [peer("a"), peer("f")],
          sharedInterest: [peer("a")],
          rest: [peer("a"), peer("c")],
        }),
      },
      new Set(["f"])
    );
    expect(ids(out.suggested)).toEqual(["a"]);
    expect(ids(out.otherUw)).toEqual(["c"]);
    expect(out.hideFromPeople.has("f")).toBe(false);
  });

  it("no input, no sections", () => {
    const out = friendsTabSuggestions(null, NONE);
    expect(out).toEqual({ suggested: [], otherUw: [], hideFromPeople: new Set() });
  });

  it("copy", () => {
    expect(SUGGESTIONS_COPY.mutual(2)).toBe("2 mutual friends");
  });
});
