import { describe, expect, it } from "vitest";

import { COMMENT_MAX_LENGTH, validateCommentBody } from "@/lib/social/comments";

describe("validateCommentBody", () => {
  it("trims", () => {
    expect(validateCommentBody("  nice  ", "Comment")).toEqual({ body: "nice" });
  });

  it("keeps the comment copy word for word, and names replies as replies", () => {
    expect(validateCommentBody("   ", "Comment")).toEqual({ error: "Comment can't be empty." });
    expect(validateCommentBody("   ", "Reply")).toEqual({ error: "Reply can't be empty." });
    expect(validateCommentBody("a".repeat(COMMENT_MAX_LENGTH + 1), "Comment")).toEqual({
      error: "Comment must be 500 characters or fewer.",
    });
  });

  it("allows exactly the cap", () => {
    expect(validateCommentBody("a".repeat(COMMENT_MAX_LENGTH), "Reply")).toEqual({
      body: "a".repeat(COMMENT_MAX_LENGTH),
    });
  });
});
