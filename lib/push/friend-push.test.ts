import { describe, expect, it } from "vitest";

import {
  composeFriendAcceptedPush,
  composeFriendRequestPush,
  friendAcceptedKey,
  friendRequestKey,
} from "@/lib/push/friend-push";
import { nudgeDedupeKey } from "@/lib/push/nudge-push";
import { recapDedupeKey } from "@/lib/push/recap-push";
import {
  commentDedupeKey,
  likeDedupeKey,
  recapCommentDedupeKey,
  recapLikeDedupeKey,
  replyDedupeKey,
} from "@/lib/push/social-push";

const UUID = "3edc1d62-dc8a-431e-8cd3-d35c9e66a934";
const OTHER = "9b1f3c2e-1111-4222-8333-944455556666";

describe("composeFriendRequestPush", () => {
  it("names the sender and opens the Friends tab", () => {
    expect(composeFriendRequestPush("Sam")).toEqual({
      title: "Sam",
      body: "sent you a friend request",
      url: "/friends",
    });
  });
});

describe("composeFriendAcceptedPush", () => {
  it("names the new friend and opens their profile", () => {
    expect(composeFriendAcceptedPush("Sam Lee", "samlee")).toEqual({
      title: "Sam Lee",
      body: "accepted your friend request",
      url: "/profile/samlee",
    });
  });

  it("falls back to the Friends tab with no handle", () => {
    expect(composeFriendAcceptedPush("Sam", null).url).toBe("/friends");
  });

  it("keeps the url an in-app path", () => {
    expect(composeFriendAcceptedPush("x", "a/b").url).toBe("/profile/a%2Fb");
  });
});

describe("friend push keys", () => {
  it("differ by kind for the same row", () => {
    expect(friendRequestKey(UUID)).not.toBe(friendAcceptedKey(UUID));
  });

  it("can't collide with the other push families", () => {
    const others = [
      likeDedupeKey(OTHER, UUID),
      commentDedupeKey(UUID),
      replyDedupeKey(UUID),
      recapLikeDedupeKey(OTHER, UUID),
      recapCommentDedupeKey(UUID),
      nudgeDedupeKey(UUID),
      recapDedupeKey(UUID, 0),
    ];
    for (const key of [friendRequestKey(UUID), friendAcceptedKey(UUID)]) {
      expect(others).not.toContain(key);
      expect(others.some((o) => o.startsWith(key.split(":")[0] + ":"))).toBe(false);
    }
  });

  it("fit APNs' 64-byte collapse id", () => {
    expect(new TextEncoder().encode(friendRequestKey(UUID)).length).toBeLessThanOrEqual(64);
    expect(new TextEncoder().encode(friendAcceptedKey(UUID)).length).toBeLessThanOrEqual(64);
  });
});
