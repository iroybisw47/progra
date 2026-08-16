import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { SOCIAL_ENABLED } from "@/lib/flags";
import {
  listBlockedUsers,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  listSuggestedUsers,
} from "@/lib/db/friends";
import { getFriendsLeaderboard } from "@/lib/db/friends-leaderboard";
import { hasUnseenNotifications } from "@/lib/db/notifications-activity";

import { FriendsClient } from "./friends-client";

// Friend management (social v2). Flag-gated: 404s entirely while the social
// build is switched off, so it never appears for current beta users.
export default async function FriendsPage() {
  if (!SOCIAL_ENABLED) notFound();
  await requireUser();

  const [
    friends,
    incoming,
    outgoing,
    blocked,
    suggested,
    unseenNotifications,
    leaderboard,
  ] = await Promise.all([
    listFriends(),
    listIncomingRequests(),
    listOutgoingRequests(),
    listBlockedUsers(),
    listSuggestedUsers(),
    hasUnseenNotifications(),
    // Shares listFriends() and getProfile() via cache(), so it adds one
    // sessions read and one goals read rather than a whole new wave.
    getFriendsLeaderboard(),
  ]);

  return (
    <FriendsClient
      friends={friends}
      incoming={incoming}
      outgoing={outgoing}
      blocked={blocked}
      suggested={suggested}
      initialUnseen={unseenNotifications}
      leaderboard={leaderboard}
    />
  );
}
