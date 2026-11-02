import type { PublicUser } from "@/lib/db/friends";

// Groups (.claude/plans/groups.sql): communities a member joins, which friends
// them with everyone already in. The pure half — shapes, ranking, copy and
// input rules — so the page, the Friends tab, onboarding and the recap agree,
// and so they can be tested without a database.

// The admin form's limits. groups.sql's check constraints carry the same
// numbers (groups_name_check, groups_description_check, groups_member_cap_check).
export const GROUP_NAME_MAX = 60;
export const GROUP_DESCRIPTION_MAX = 280;
export const GROUP_CAP_MIN = 2;
export const GROUP_CAP_MAX = 500;
export const GROUP_CAP_DEFAULT = 50;

// Below this many ranked members a group shows "Invite your group" rather than
// a leaderboard of one.
export const GROUP_LEADERBOARD_MIN = 2;

// One row of list_groups(): every live group, as the caller sees it.
export type GroupSummary = {
  groupId: string;
  name: string;
  description: string | null;
  memberCap: number;
  // The real count, blocked members included — the header's "N/50".
  memberCount: number;
  isMember: boolean;
  // How many members joining would friend you with: not you, not blocked
  // either way, not a pair one of you unfriended. The join line's N.
  friendableCount: number;
  // Whether joining friends you with every member (groups.sql STEP 4). Off,
  // it's an OPEN group: no friendships, and members see each other's shared
  // sessions as view-only cards in the group's own feed. Fixed at creation.
  autoFriend: boolean;
};

export type ListGroupsRow = {
  id: string;
  name: string;
  description: string | null;
  member_cap: number;
  member_count: number;
  is_member: boolean;
  friendable_count: number;
  // Absent before STEP 4 had run, when every group auto-friended.
  auto_friend?: boolean;
};

export function rowToGroupSummary(row: ListGroupsRow): GroupSummary {
  return {
    groupId: row.id,
    name: row.name,
    description: row.description,
    memberCap: row.member_cap,
    memberCount: row.member_count,
    isMember: row.is_member,
    friendableCount: row.friendable_count,
    autoFriend: row.auto_friend ?? true,
  };
}

// Full at the cap — and past it, which happens only when an admin lowers a cap
// below the current count. Existing members stay; nobody new gets in.
export function isGroupFull(g: Pick<GroupSummary, "memberCount" | "memberCap">): boolean {
  return g.memberCount >= g.memberCap;
}

// What joining does, said before you do it. The join sheet and onboarding's
// group step both show this line.
export function joinCopy(
  g: Pick<GroupSummary, "memberCount" | "friendableCount"> & { autoFriend?: boolean }
): string {
  // An open group friends nobody: what joining shares is the group feed.
  if (g.autoFriend === false) {
    if (g.memberCount === 0) {
      return "You’ll be the first member. Members see each other’s sessions in the group feed. Nobody is friended automatically.";
    }
    const members = g.memberCount === 1 ? "Its 1 member" : `Its ${g.memberCount} members`;
    return `${members} will see your sessions in the group feed. Nobody is friended automatically: add the people you want.`;
  }
  if (g.memberCount === 0) {
    return "You’ll be the first member. Everyone who joins becomes your friend and sees your sessions.";
  }
  if (g.friendableCount === 0) return "You won’t be friends with anyone new here.";
  if (g.friendableCount === 1) return "You’ll be friends with its 1 member, and they’ll see your sessions.";
  return `You’ll be friends with all ${g.friendableCount} members, and they’ll see your sessions.`;
}

export type GroupLeaderRow = {
  user: PublicUser;
  rank: number;
  isMe: boolean;
  totalMs: number;
};

// Every member ranked by this week's worked time, zero-hour members included
// (unlike rankLeaderboard, which drops them: a group lists everyone in it).
// Ties share a rank — 1, 1, 3 — and read alphabetically within it, so a
// Monday-morning board of zeroes is a stable list rather than a shuffle.
export function rankGroupRows(
  rows: readonly { user: PublicUser; isMe: boolean; totalMs: number }[]
): GroupLeaderRow[] {
  const label = (u: PublicUser) => (u.displayName || u.username).toLocaleLowerCase();
  const sorted = [...rows].sort(
    (a, b) => b.totalMs - a.totalMs || label(a.user).localeCompare(label(b.user))
  );
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.totalMs !== sorted[i - 1].totalMs) rank = i + 1;
    return { ...r, rank };
  });
}

// "#2 of 14 in your group" — the group page, and each row of the recap's rank
// slide.
export function groupRankLine(rank: number, of: number): string {
  return `#${rank} of ${of} in your group`;
}

// A member cap, as groups_member_cap_check and admin_set_group_cap check it.
export function validateGroupCap(cap: number): { ok: true } | { error: string } {
  return Number.isInteger(cap) && cap >= GROUP_CAP_MIN && cap <= GROUP_CAP_MAX
    ? { ok: true }
    : { error: `The cap must be a whole number from ${GROUP_CAP_MIN} to ${GROUP_CAP_MAX}.` };
}

// What lowering a cap means, said before it's saved: below the current count
// nobody is removed, the group just stops taking new members.
export function capChangeNote(memberCount: number, cap: number): string | null {
  return Number.isInteger(cap) && cap < memberCount
    ? `Below its ${memberCount} members: nobody is removed, but nobody new can join until some leave.`
    : null;
}

// The admin form, checked the way the database will check it, so a typo gets
// a sentence instead of a generic failure.
export function validateGroupInput(input: {
  name: string;
  description: string;
  cap: number;
  autoFriend?: boolean;
}):
  | { ok: true; name: string; description: string | null; cap: number; autoFriend: boolean }
  | { error: string } {
  const name = input.name.trim();
  if (name.length === 0) return { error: "Give the group a name." };
  if (name.length > GROUP_NAME_MAX) return { error: `Names are at most ${GROUP_NAME_MAX} characters.` };
  const description = input.description.trim();
  if (description.length > GROUP_DESCRIPTION_MAX) {
    return { error: `Descriptions are at most ${GROUP_DESCRIPTION_MAX} characters.` };
  }
  const cap = validateGroupCap(input.cap);
  if ("error" in cap) return cap;
  return { ok: true, name, description: description || null, cap: input.cap, autoFriend: input.autoFriend ?? true };
}

// What leaving does, said before it does it.
export function leaveCopy(g: Pick<GroupSummary, "autoFriend">): string {
  return g.autoFriend
    ? "You’ll stop being friends with members you only know through this group. Friends you added yourself stay."
    : "You’ll leave the group and its feed. Your friends stay your friends.";
}

// Which kind of group this is, in a line: the page header and the admin list.
export function groupModeLine(g: Pick<GroupSummary, "autoFriend">): string {
  return g.autoFriend ? "Joining friends you with every member" : "Open group: add friends yourself";
}

// "12/50 members" — the group header's count, out of its cap.
export function memberCountLine(g: Pick<GroupSummary, "memberCount" | "memberCap">): string {
  return `${g.memberCount}/${g.memberCap} ${g.memberCap === 1 ? "member" : "members"}`;
}

// Words the group surfaces share, so the page, the Friends tab's Groups list
// and onboarding's step say the same thing.
export const GROUP_COPY = {
  eyebrow: "Group",
  leaderboard: "Leaderboard",
  feed: "Feed",
  members: "Members",
  thisWeek: "This week",
  invite: "Invite your group",
  inviteSub: "The leaderboard starts once someone else joins. Send them the app.",
  feedEmpty: "No sessions from your friends here in the last week.",
  notMember: "Join to see its members, feed and leaderboard.",
  join: "Join",
  joinGroup: "Join group",
  joined: "Joined",
  full: "Full",
  leave: "Leave",
  leaveGroup: "Leave group",
  open: "Open",
  openFeedEmpty: "No sessions shared in this group in the last week.",
  unfriend: "Unfriend",
  addFriend: "Add friend",
  unfriendBody:
    "They stay in the group, but neither this group nor any other will make you friends again. You can still add them yourself.",
  you: "You",
  joinFailed: "Couldn’t join that group.",
  leaveFailed: "Couldn’t leave that group.",
} as const;

// The toast after joining.
export function joinedToast(newFriends: number): string {
  if (newFriends <= 0) return "You’re in";
  return `You’re in — ${newFriends} new ${newFriends === 1 ? "friend" : "friends"}`;
}

// The Friends tab's two sub-tabs. `?tab=groups` opens Groups (the recap's "Join
// a group" link lands there); anything else, or GROUPS off, is Friends.
export type FriendsSubTab = "friends" | "groups";

export function friendsSubTabFrom(value: string | string[] | undefined, groupsOn: boolean): FriendsSubTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return groupsOn && raw === "groups" ? "groups" : "friends";
}

export const GROUPS_TAB_COPY = {
  friends: "Friends",
  groups: "Groups",
  yours: "Your groups",
  browse: "Browse",
  noneYet: "You’re not in a group yet. Join one below — you’ll be friends with everyone in it.",
  noneToJoin: "No other groups to join right now.",
} as const;
