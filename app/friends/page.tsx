import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { SOCIAL_ENABLED } from "@/lib/flags";
import {
  listBlockedUsers,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
} from "@/lib/db/friends";

import { FriendsClient } from "./friends-client";

// Friend management (social v2). Flag-gated: 404s entirely while the social
// build is switched off, so it never appears for current beta users.
export default async function FriendsPage() {
  if (!SOCIAL_ENABLED) notFound();
  await requireUser();

  const [friends, incoming, outgoing, blocked] = await Promise.all([
    listFriends(),
    listIncomingRequests(),
    listOutgoingRequests(),
    listBlockedUsers(),
  ]);

  return (
    <FriendsClient
      friends={friends}
      incoming={incoming}
      outgoing={outgoing}
      blocked={blocked}
    />
  );
}
