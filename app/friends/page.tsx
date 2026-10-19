import { notFound } from "next/navigation";

import { getProfile } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/require-user";
import { FRIENDS_V3, SOCIAL_ENABLED, UW } from "@/lib/flags";
import {
  listBlockedUsers,
  listFriends,
  listIncomingRequests,
  listFriendSuggestions,
  listOutgoingRequests,
  listSuggestedUsers,
} from "@/lib/db/friends";
import {
  getFriendsLeaderboard,
  getFriendsWeekRows,
} from "@/lib/db/friends-leaderboard";
import { listActiveGoals, listActiveGoalsForUsers } from "@/lib/db/goals";
import { hasUnseenNotifications } from "@/lib/db/notifications-activity";
import { listUwPeerGroups } from "@/lib/db/uw";
import type { SuggestionsInput } from "@/lib/friend-suggestions";
import { buildFriendRows, inviteGoalTitle } from "@/lib/friends-tab";
import { friendsTabUw } from "@/lib/uw-groups";
import { uwPromptFor } from "@/lib/uw-prompt";
import { UwPromptCard } from "@/components/v2/uw-prompt-card";

import { FriendsClient } from "./friends-client";
import { FriendsClientV3 } from "./friends-client-v3";

// Friend management (social v2). Flag-gated: 404s entirely while the social
// build is switched off, so it never appears for current beta users.
export default async function FriendsPage() {
  if (!SOCIAL_ENABLED) notFound();
  await requireUser();
  // The v3 tab (plan P8) has its own reads, below. Off, everything after this
  // line is the tab as it was.
  if (FRIENDS_V3) return <FriendsPageV3 />;

  const [
    friends,
    incoming,
    outgoing,
    blocked,
    suggested,
    unseenNotifications,
    leaderboard,
    uwPrompt,
    suggestions,
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
    readUwPromptCard(),
    readSuggestions(),
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
      uwPrompt={uwPrompt}
      suggestions={suggestions}
    />
  );
}

// "Suggested friends" under the leaderboard (lib/friend-suggestions.ts). One
// RPC either way, chained off the cached profile: a UW student's UW matches
// (list_uw_peers, which also feeds "Other people at UW"), or anyone else's
// friends of friends (list_friend_suggestions).
async function readSuggestions(): Promise<SuggestionsInput> {
  const profile = await getProfile();
  if (UW && profile?.is_uw === true) {
    return { kind: "uw", groups: await listUwPeerGroups() };
  }
  return { kind: "fof", people: await listFriendSuggestions() };
}

// The v3 tab's reads, all server-side and all cache()d, in one wave.
//
// "Your friends" is listFriends with this week's hours from getFriendsWeekRows
// (unranked, zero-hour friends kept, the caller's own week) and "Working on"
// from the week's top goal, falling back to listActiveGoalsForUsers. That
// last read needs the friend ids, so it chains off listFriends' promise rather
// than waiting for the whole wave: getFriendsWeekRows awaits the same cached
// listFriends and then two reads of its own, so it finishes no sooner, and the
// goals read costs no extra latency. The viewer's own goals name the invite.
// No getFriendsLeaderboard: v3 has no leaderboard (D12).
//
// With UW on, a UW student also gets their three UW groups (R:168, P9d):
// listUwPeerGroups, the first page of each, chained off the profile (cached,
// and the layout's own read, so usually already in hand) and asked only when
// it says is_uw. Anyone else costs no RPC call. A listing switched off
// doesn't matter: it decides who sees them, not what they see. People they're
// already connected to never come back from the RPC (any friendships row),
// which is what keeps a revalidated tab agreeing with its optimistic one. A
// failed RPC still hands the tab a UW answer, with no groups, so it keeps the
// ones it has rather than taking the student for someone outside the cohort.
async function FriendsPageV3() {
  const friendsRead = listFriends();
  const uwRead = UW
    ? getProfile().then(async (p) =>
        p?.is_uw === true ? friendsTabUw(p, await listUwPeerGroups()) : null
      )
    : null;
  const [
    friends,
    incoming,
    outgoing,
    blocked,
    suggested,
    unseenNotifications,
    weekRows,
    friendGoals,
    myGoals,
    uw,
    uwPrompt,
  ] = await Promise.all([
    friendsRead,
    listIncomingRequests(),
    listOutgoingRequests(),
    listBlockedUsers(),
    listSuggestedUsers(),
    hasUnseenNotifications(),
    getFriendsWeekRows(),
    friendsRead.then((f) => listActiveGoalsForUsers(f.map((x) => x.user.userId))),
    listActiveGoals(),
    uwRead,
    readUwPromptCard(),
  ]);

  return (
    <FriendsClientV3
      friends={buildFriendRows(friends, weekRows, friendGoals)}
      incoming={incoming}
      outgoing={outgoing}
      blocked={blocked}
      suggested={suggested}
      initialUnseen={unseenNotifications}
      inviteGoal={inviteGoalTitle(myGoals)}
      uw={uw}
      uwPrompt={uwPrompt}
    />
  );
}

// The UW info prompt's card (lib/uw-prompt.ts), on either tab, while the
// viewer hasn't answered. getProfile() is cache()d and the layout's own read,
// so this costs nothing.
async function readUwPromptCard() {
  if (!UW) return null;
  const profile = await getProfile();
  if (!profile || !uwPromptFor(profile, UW).card) return null;
  return (
    <UwPromptCard
      stamped={profile.uw_prompt === "later"}
      groupsLive={FRIENDS_V3}
    />
  );
}
