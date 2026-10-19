// WHAT a friend push says and where a tap lands, pure, so the copy is
// testable without touching APNs. Mirrors lib/push/nudge-push.ts; the
// orchestrator (lib/push/send-friend-push.ts) consumes this and
// lib/push/apns.ts sends it.
//
// Two kinds: someone sent you a request (to the addressee), and someone
// accepted yours (to the requester). Both bodies are system-generated, with
// nothing typed by another user beyond the name every list already shows.

export type FriendPushContent = {
  title: string;
  body: string;
  // In-app path a tap navigates to; rides in the push payload and is followed
  // by components/notification-tap-router.tsx.
  url: string;
};

// The request to answer is at the top of the Friends tab, in either version
// of it, with Accept and Decline on the row.
export function composeFriendRequestPush(actorName: string): FriendPushContent {
  return { title: actorName, body: "sent you a friend request", url: "/friends" };
}

// Your new friend's profile, or the Friends tab when they have no handle to
// link to (an account that never finished onboarding can't accept, but the
// fallback costs nothing).
export function composeFriendAcceptedPush(
  actorName: string,
  actorUsername: string | null
): FriendPushContent {
  return {
    title: actorName,
    body: "accepted your friend request",
    url: actorUsername ? `/profile/${encodeURIComponent(actorUsername)}` : "/friends",
  };
}

// At most once per friendships row and kind (push_log is keyed on these).
// Also the APNs collapse id, which allows 64 bytes: a uuid makes these 51
// and 52. A request sent, cancelled and sent again is a new row, so a new
// key; a row re-accepted can't happen (accept only moves pending rows).
export function friendRequestKey(friendshipId: string): string {
  return `friend-request:${friendshipId}`;
}

export function friendAcceptedKey(friendshipId: string): string {
  return `friend-accepted:${friendshipId}`;
}
