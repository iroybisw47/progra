import { describe, expect, it } from "vitest";

import {
  commentDedupeKey,
  commentSnippet,
  composeSocialPush,
  likeDedupeKey,
} from "@/lib/push/social-push";

describe("composeSocialPush", () => {
  it("says 'liked' for the heart's underlying 👍", () => {
    const out = composeSocialPush({
      kind: "like",
      actorName: "Maya P.",
      emoji: "👍",
      sessionId: "s1",
      taskName: "Math revision",
    });
    expect(out.title).toBe("Maya P.");
    expect(out.body).toBe('liked your session "Math revision"');
    expect(out.url).toBe("/session/s1");
  });

  it("names any other palette emoji", () => {
    const out = composeSocialPush({
      kind: "like",
      actorName: "Maya P.",
      emoji: "🔥",
      sessionId: "s1",
      taskName: "Math revision",
    });
    expect(out.body).toBe('reacted 🔥 to your session "Math revision"');
  });

  it("quotes the comment with the session it's on", () => {
    const out = composeSocialPush({
      kind: "comment",
      actorName: "Maya P.",
      sessionId: "s1",
      taskName: "Math revision",
      commentBody: "nice run!",
    });
    expect(out.body).toBe('commented on "Math revision": nice run!');
    expect(out.url).toBe("/session/s1");
  });
});

describe("commentSnippet", () => {
  it("passes short comments through, trimmed", () => {
    expect(commentSnippet("  nice run!  ")).toBe("nice run!");
  });

  it("keeps a 100-char comment whole", () => {
    const exact = "a".repeat(100);
    expect(commentSnippet(exact)).toBe(exact);
  });

  it("truncates past 100 chars with an ellipsis, no trailing space", () => {
    const long = `${"a".repeat(98)} ${"b".repeat(30)}`;
    const out = commentSnippet(long);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith("…")).toBe(true);
    // The head is the original text, not a reflow.
    expect(long.startsWith(out.slice(0, -1).trimEnd())).toBe(true);
    // No "word …" gap — the ellipsis hugs the text.
    expect(out).not.toMatch(/\s…$/);
  });
});

// The push_log primary key IS the dedupe semantics: likes once per
// (actor, session) — the reaction row is deleted on toggle-off, so the log is
// the only memory — comments once per comment.
describe("dedupe keys", () => {
  it("likes key on actor+session, comments key on the comment", () => {
    expect(likeDedupeKey("u1", "s1")).toBe("like:u1:s1");
    expect(likeDedupeKey("u1", "s2")).not.toBe(likeDedupeKey("u1", "s1"));
    expect(commentDedupeKey("c1")).toBe("comment:c1");
  });
});
