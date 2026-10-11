import {
  acceptFriendRequest,
  cancelFriendRequest,
  removeFriendship,
  searchUsers,
  sendFriendRequest,
  unblockUser,
} from "@/app/actions/friends";
import { fetchMoreUwPeers } from "@/app/actions/uw";
import { track } from "@/lib/analytics";
import type { FriendsTabServices } from "@/lib/friends-tab";
import { shareInvite } from "@/lib/invite-share";

// The services the v3 Friends tab runs on in production: the real server
// actions and the real analytics client, unchanged. lib/friends-tab.ts has
// why the tab takes them as an object at all (the dev preview passes fakes).
//
// No "use client" or "use server" here, as app/onboarding/v3/services.ts:
// only client components import it, so the action imports land in the client
// bundle as the usual action references.
export const REAL_FRIENDS_SERVICES: FriendsTabServices = {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  cancelFriendRequest,
  unblockUser,
  fetchMoreUwPeers,
  shareInvite,
  track,
};
