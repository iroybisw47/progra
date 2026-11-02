import { describe, expect, it } from "vitest";

import type { PublicUser } from "@/lib/db/friends";
import {
  GROUP_CAP_DEFAULT,
  groupRankLine,
  isGroupFull,
  joinCopy,
  friendsSubTabFrom,
  joinedToast,
  memberCountLine,
  rankGroupRows,
  rowToGroupSummary,
  validateGroupInput,
} from "@/lib/groups";

const user = (username: string, displayName: string | null = null): PublicUser => ({
  userId: username,
  username,
  displayName,
  bio: null,
  avatarUrl: null,
});

describe("rankGroupRows", () => {
  it("ranks by time, keeps zero-hour members, and shares a rank on a tie", () => {
    const rows = rankGroupRows([
      { user: user("cat"), isMe: false, totalMs: 0 },
      { user: user("ann"), isMe: false, totalMs: 3_600_000 },
      { user: user("bob"), isMe: true, totalMs: 3_600_000 },
      { user: user("dan"), isMe: false, totalMs: 60_000 },
      { user: user("abe"), isMe: false, totalMs: 0 },
    ]);
    expect(rows.map((r) => [r.user.username, r.rank])).toEqual([
      ["ann", 1],
      ["bob", 1],
      ["dan", 3],
      ["abe", 4],
      ["cat", 4],
    ]);
    expect(rows.find((r) => r.isMe)?.user.username).toBe("bob");
  });

  it("orders a tie by the name people see, ignoring case", () => {
    const rows = rankGroupRows([
      { user: user("zed", "alice"), isMe: false, totalMs: 0 },
      { user: user("amy", "Zoe"), isMe: false, totalMs: 0 },
      { user: user("bea"), isMe: false, totalMs: 0 },
    ]);
    expect(rows.map((r) => r.user.username)).toEqual(["zed", "bea", "amy"]);
  });

  it("is empty for nobody", () => {
    expect(rankGroupRows([])).toEqual([]);
  });
});

describe("joinCopy", () => {
  it("says who you'll be friends with", () => {
    expect(joinCopy({ memberCount: 12, friendableCount: 12 })).toBe(
      "You’ll be friends with all 12 members, and they’ll see your sessions."
    );
  });
  it("counts only the members you'd actually be friended with", () => {
    expect(joinCopy({ memberCount: 12, friendableCount: 10 })).toContain("all 10 members");
  });
  it("reads right for one member", () => {
    expect(joinCopy({ memberCount: 1, friendableCount: 1 })).toBe(
      "You’ll be friends with its 1 member, and they’ll see your sessions."
    );
  });
  it("an empty group: you're the first", () => {
    expect(joinCopy({ memberCount: 0, friendableCount: 0 })).toMatch(/^You’ll be the first member\./);
  });
  it("never says 'all 0 members'", () => {
    expect(joinCopy({ memberCount: 3, friendableCount: 0 })).toBe("You won’t be friends with anyone new here.");
  });
});

describe("isGroupFull", () => {
  it("is full at the cap and past it (a lowered cap)", () => {
    expect(isGroupFull({ memberCount: 49, memberCap: 50 })).toBe(false);
    expect(isGroupFull({ memberCount: 50, memberCap: 50 })).toBe(true);
    expect(isGroupFull({ memberCount: 12, memberCap: 10 })).toBe(true);
  });
});

describe("groupRankLine", () => {
  it("is the spec's line", () => {
    expect(groupRankLine(2, 14)).toBe("#2 of 14 in your group");
  });
});

describe("rowToGroupSummary", () => {
  it("maps list_groups' row", () => {
    expect(
      rowToGroupSummary({
        id: "g",
        name: "UW CS",
        description: null,
        member_cap: 50,
        member_count: 3,
        is_member: true,
        friendable_count: 2,
      })
    ).toEqual({
      groupId: "g",
      name: "UW CS",
      description: null,
      memberCap: 50,
      memberCount: 3,
      isMember: true,
      friendableCount: 2,
    });
  });
});

describe("validateGroupInput", () => {
  const ok = { name: "  UW CS  ", description: "  ", cap: GROUP_CAP_DEFAULT };
  it("trims, and an empty description is none", () => {
    expect(validateGroupInput(ok)).toEqual({ ok: true, name: "UW CS", description: null, cap: 50 });
  });
  it("refuses a missing or long name", () => {
    expect(validateGroupInput({ ...ok, name: "   " })).toHaveProperty("error");
    expect(validateGroupInput({ ...ok, name: "x".repeat(61) })).toHaveProperty("error");
    expect(validateGroupInput({ ...ok, name: "x".repeat(60) })).toHaveProperty("ok");
  });
  it("refuses a long description", () => {
    expect(validateGroupInput({ ...ok, description: "x".repeat(281) })).toHaveProperty("error");
  });
  it("refuses a cap outside 2–500 or not whole", () => {
    for (const cap of [1, 501, 2.5, Number.NaN]) {
      expect(validateGroupInput({ ...ok, cap })).toHaveProperty("error");
    }
    for (const cap of [2, 500]) expect(validateGroupInput({ ...ok, cap })).toHaveProperty("ok");
  });
});

describe("memberCountLine", () => {
  it("is the count out of the cap", () => {
    expect(memberCountLine({ memberCount: 12, memberCap: 50 })).toBe("12/50 members");
    expect(memberCountLine({ memberCount: 12, memberCap: 10 })).toBe("12/10 members");
  });
});

describe("joinedToast", () => {
  it("counts the new friends, or doesn't mention them", () => {
    expect(joinedToast(0)).toBe("You’re in");
    expect(joinedToast(1)).toBe("You’re in — 1 new friend");
    expect(joinedToast(7)).toBe("You’re in — 7 new friends");
  });
});

describe("friendsSubTabFrom", () => {
  it("opens Groups only for ?tab=groups with GROUPS on", () => {
    expect(friendsSubTabFrom("groups", true)).toBe("groups");
    expect(friendsSubTabFrom(["groups", "x"], true)).toBe("groups");
    expect(friendsSubTabFrom("groups", false)).toBe("friends");
    expect(friendsSubTabFrom(undefined, true)).toBe("friends");
    expect(friendsSubTabFrom("nope", true)).toBe("friends");
  });
});
