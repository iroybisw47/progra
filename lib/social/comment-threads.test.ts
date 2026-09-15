import { describe, expect, it } from "vitest";

import {
  commentAnchorId,
  groupCommentThreads,
  parseCommentAnchor,
  replyMention,
  splitReplies,
  threadOf,
  type ThreadableComment,
} from "@/lib/social/comment-threads";

const user = (userId: string) => ({ userId, username: userId, displayName: null });

// id, author, parent root, the comment replied to, and who that was.
function c(
  id: string,
  author: string,
  parentId: string | null = null,
  replyToId: string | null = parentId,
  replyTo: string | null = null
): ThreadableComment {
  return {
    id,
    author: { userId: author },
    parentId,
    replyToId,
    replyTo: replyTo === null ? null : user(replyTo),
  };
}

describe("groupCommentThreads", () => {
  it("files replies under their root, keeping oldest-first at both levels", () => {
    const threads = groupCommentThreads([
      c("r1", "a"),
      c("r2", "b"),
      c("x1", "b", "r1", "r1", "a"),
      c("x2", "c", "r1", "x1", "b"),
      c("x3", "a", "r2", "r2", "b"),
    ]);
    expect(threads.map((t) => [t.root.id, t.replies.map((r) => r.id)])).toEqual([
      ["r1", ["x1", "x2"]],
      ["r2", ["x3"]],
    ]);
  });

  it("renders a reply whose root was dropped as its own top-level comment", () => {
    const threads = groupCommentThreads([c("r1", "a"), c("x9", "b", "gone", "gone", "z")]);
    expect(threads.map((t) => t.root.id)).toEqual(["r1", "x9"]);
  });

  it("is a plain list when nothing is a reply", () => {
    const threads = groupCommentThreads([c("r1", "a"), c("r2", "b")]);
    expect(threads.every((t) => t.replies.length === 0)).toBe(true);
  });
});

describe("replyMention", () => {
  it("names the person when replying to a reply", () => {
    expect(replyMention(c("x2", "c", "r1", "x1", "b"))?.userId).toBe("b");
  });

  it("says nothing for a reply to the root — that's who it's obviously to", () => {
    expect(replyMention(c("x1", "b", "r1", "r1", "a"))).toBe(null);
  });

  it("keeps the @name after the replied-to comment is deleted", () => {
    expect(replyMention(c("x2", "c", "r1", null, "b"))?.userId).toBe("b");
  });

  it("never mentions yourself, and never on a root", () => {
    expect(replyMention(c("x2", "b", "r1", "x1", "b"))).toBe(null);
    expect(replyMention(c("r1", "a"))).toBe(null);
  });
});

describe("splitReplies", () => {
  const replies = ["a", "b", "c", "d"];

  it("shows up to three without collapsing", () => {
    expect(splitReplies(replies.slice(0, 3), false)).toEqual({ shown: ["a", "b", "c"], hiddenCount: 0 });
  });

  it("collapses four or more to the first two", () => {
    expect(splitReplies(replies, false)).toEqual({ shown: ["a", "b"], hiddenCount: 2 });
  });

  it("shows everything once expanded", () => {
    expect(splitReplies(replies, true)).toEqual({ shown: replies, hiddenCount: 0 });
  });
});

describe("anchors", () => {
  const id = "0b6f4a8e-3c1d-4e2f-9a7b-5c6d7e8f9a0b";

  it("round-trips a comment id through the hash", () => {
    expect(parseCommentAnchor(`#${commentAnchorId(id)}`)).toBe(id);
  });

  it("rejects anything that isn't a comment anchor", () => {
    for (const bad of ["", "#", "#c-", "#c-nope", `c-${id}`, `#x-${id}`]) {
      expect(parseCommentAnchor(bad)).toBe(null);
    }
  });

  it("finds the thread holding a comment", () => {
    const threads = groupCommentThreads([c("r1", "a"), c("r2", "b"), c("x1", "a", "r2", "r2", "b")]);
    expect(threadOf(threads, "x1")).toBe("r2");
    expect(threadOf(threads, "r1")).toBe("r1");
    expect(threadOf(threads, "missing")).toBe(null);
  });
});
