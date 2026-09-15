import { describe, expect, it } from "vitest";

import { mergeReplyNotifications } from "@/lib/social/reply-notifications";

const row = (id: string, author_id: string) => ({ id, author_id });

describe("mergeReplyNotifications", () => {
  it("shows a reply to me on my own post once, as the reply", () => {
    const out = mergeReplyNotifications({
      me: "me",
      commentRows: [row("x1", "b"), row("c2", "c")],
      replyRows: [row("x1", "b")],
      blockedIds: new Set(),
    });
    expect(out.commentRows.map((r) => r.id)).toEqual(["c2"]);
    expect(out.replyRows.map((r) => r.id)).toEqual(["x1"]);
  });

  it("keeps a reply to someone else on my post as an ordinary comment", () => {
    const out = mergeReplyNotifications({
      me: "me",
      commentRows: [row("x5", "b")],
      replyRows: [],
      blockedIds: new Set(),
    });
    expect(out.commentRows.map((r) => r.id)).toEqual(["x5"]);
  });

  it("drops a blocked reply to me everywhere — it can't come back as 'commented'", () => {
    const out = mergeReplyNotifications({
      me: "me",
      commentRows: [row("x1", "blocked")],
      replyRows: [row("x1", "blocked"), row("x2", "blocked")],
      blockedIds: new Set(["blocked"]),
    });
    expect(out.commentRows).toEqual([]);
    expect(out.replyRows).toEqual([]);
  });

  it("never notifies me about my own reply", () => {
    const out = mergeReplyNotifications({
      me: "me",
      commentRows: [],
      replyRows: [row("x1", "me")],
      blockedIds: new Set(),
    });
    expect(out.replyRows).toEqual([]);
  });
});
