import type { FriendSuggestion, PublicUser } from "@/lib/db/friends";
import { uwSubline } from "@/lib/uw-groups";
import type { UwGroupKey, UwGroupPeer, UwPeerGroups } from "@/lib/uw-peers";

// The legacy Friends tab's suggestions, under the leaderboard.
//
// A UW student's come from list_uw_peers (lib/db/uw.ts): "Suggested friends"
// is everyone who shares a major or an interest (the RPC files a person under
// one bucket only, major first, so both buckets together are "has your
// interests"), and "Other people at UW" is the rest, shown before People on
// Progra. Anyone else gets friends of friends (list_friend_suggestions),
// ranked by mutual friends. Both RPCs already drop anyone the viewer has any
// friendships row with; the friend filter here is belt and braces for a
// refresh that lands between two reads.

export type SuggestionsInput =
  | { kind: "uw"; groups: UwPeerGroups | null }
  | { kind: "fof"; people: FriendSuggestion[] };

export type SuggestionUser = Pick<PublicUser, "userId" | "username" | "displayName" | "avatarUrl">;
export type SuggestionRow = { user: SuggestionUser; subline: string | null };

export type FriendsTabSuggestions = {
  suggested: SuggestionRow[];
  otherUw: SuggestionRow[];
  // Everyone listed above People on Progra, so nobody shows up twice.
  hideFromPeople: ReadonlySet<string>;
};

export const SUGGESTIONS_COPY = {
  suggested: "Suggested friends",
  otherUw: "Other people at UW",
  mutual: (n: number) => (n === 1 ? "1 mutual friend" : `${n} mutual friends`),
} as const;

function uwRow(key: UwGroupKey, peer: UwGroupPeer): SuggestionRow {
  return {
    user: {
      userId: peer.userId,
      username: peer.username,
      displayName: peer.displayName,
      avatarUrl: peer.avatarUrl,
    },
    subline: uwSubline(key, peer).text,
  };
}

export function friendsTabSuggestions(
  input: SuggestionsInput | null,
  friendIds: ReadonlySet<string>
): FriendsTabSuggestions {
  let suggested: SuggestionRow[] = [];
  let otherUw: SuggestionRow[] = [];
  if (input?.kind === "uw" && input.groups) {
    const g = input.groups;
    suggested = [
      ...g.sameMajor.map((p) => uwRow("sameMajor", p)),
      ...g.sharedInterest.map((p) => uwRow("sharedInterest", p)),
    ];
    otherUw = g.rest.map((p) => uwRow("rest", p));
  } else if (input?.kind === "fof") {
    suggested = input.people.map((p) => ({
      user: {
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
      },
      subline: SUGGESTIONS_COPY.mutual(p.mutualCount),
    }));
  }

  // Not a friend, and listed once: the first section a person lands in wins.
  const seen = new Set<string>();
  const keep = (rows: SuggestionRow[]) =>
    rows.filter((r) => {
      if (friendIds.has(r.user.userId) || seen.has(r.user.userId)) return false;
      seen.add(r.user.userId);
      return true;
    });
  suggested = keep(suggested);
  otherUw = keep(otherUw);

  return { suggested, otherUw, hideFromPeople: seen };
}
