import { notFound } from "next/navigation";

import { InviteShare } from "@/components/v2/invite-share";
import { SessionCard } from "@/components/v2/session-card";
import { BackButton } from "@/components/v2/back-button";
import { requireUser } from "@/lib/auth/require-user";
import { listCommentsForSessions } from "@/lib/db/comments";
import {
  getGroup,
  getGroupLeaderboardThisWeek,
  listGroupFeed,
  listGroupMembers,
  listOpenGroupFeed,
  requestNow,
  type GroupMemberRelation,
} from "@/lib/db/groups";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { GROUPS } from "@/lib/flags";
import {
  GROUP_COPY,
  GROUP_LEADERBOARD_MIN,
  groupModeLine,
  groupRankLine,
  memberCountLine,
} from "@/lib/groups";
import { LIKE_EMOJI } from "@/lib/social/reactions";

import { GroupLeaderboard } from "./group-leaderboard";
import { GroupMembers } from "./group-members";
import { GroupTabs } from "./group-tabs";
import { MembershipButton } from "./membership-button";
import { OpenFeed } from "./open-feed";

// One group (.claude/plans/groups.sql): its name, description and "12/50
// members", then — for members only — this week's leaderboard of everyone in
// it, the feed (finished sessions from the members you're friends with) and
// the member list, each member with what you can do: Unfriend, Add friend,
// Requested, Accept. A non-member sees the header and Join, nothing of who's
// in it. Behind GROUPS; an archived or unknown group 404s.
//
// Every read is a definer RPC that drops anyone blocked with you either way,
// so a block hides the pair from each other here entirely. In an auto-friend
// group the feed is the home feed's own read narrowed to the group, so private
// sessions follow the home feed's rule. In an OPEN group (groups.sql STEP 4)
// nobody was friended by joining, so the feed is group_feed's view-only cards
// of every member's shared sessions, with Add friend on each (OpenFeed).
export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!GROUPS) notFound();
  await requireUser();
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const header = (
    <>
      <header className="flex items-center gap-2.5 px-5">
        <BackButton />
        <span className="section-label">{GROUP_COPY.eyebrow}</span>
      </header>
      <div className="flex items-start gap-3 px-5 pt-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-ink font-serif text-[22px] leading-[1.2] font-medium tracking-[-0.015em] text-balance">
            {group.name}
          </h1>
          <span className="text-faint text-[13px] tabular-nums">
            {memberCountLine(group)}
          </span>
          <span className="text-caption text-[12px]">
            {groupModeLine(group)}
          </span>
        </div>
        {group.isMember && <MembershipButton group={group} />}
      </div>
      {group.description && (
        <p className="text-body px-5 pt-2.5 text-[13px] text-pretty">
          {group.description}
        </p>
      )}
    </>
  );

  if (!group.isMember) {
    return (
      <div className="flex flex-1 flex-col items-center pt-7 pb-24">
        <main className="flex w-full max-w-md flex-col">
          {header}
          <div className="flex flex-col gap-3 px-5 pt-5">
            <MembershipButton group={group} />
            <p className="text-caption text-center text-[13px] text-pretty">
              {GROUP_COPY.notMember}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // One wave. Comments and likes are session-keyed, so they chain off the
  // feed alone, as on the Feed tab — an auto-friend group's only: an open
  // group's cards have neither.
  const feedRead = group.autoFriend ? listGroupFeed(id) : Promise.resolve([]);
  const [
    board,
    members,
    feed,
    openFeed,
    commentsBySession,
    reactionsBySession,
  ] = await Promise.all([
    getGroupLeaderboardThisWeek(id),
    listGroupMembers(id),
    feedRead,
    group.autoFriend ? [] : listOpenGroupFeed(id),
    feedRead.then((items) =>
      listCommentsForSessions(items.map((i) => i.sessionId)),
    ),
    feedRead.then((items) =>
      listReactionsForSessions(items.map((i) => i.sessionId)),
    ),
  ]);
  const me = board.find((r) => r.isMe);
  const now = requestNow();

  const leaderboard =
    board.length < GROUP_LEADERBOARD_MIN ? (
      <div className="flex flex-col gap-3 px-5 pt-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink font-serif text-[17px] font-medium">
            {GROUP_COPY.invite}
          </h2>
          <p className="text-caption text-[13px] text-pretty">
            {GROUP_COPY.inviteSub}
          </p>
        </div>
        <InviteShare />
      </div>
    ) : (
      <GroupLeaderboard
        rows={board}
        line={me ? groupRankLine(me.rank, board.length) : null}
      />
    );

  const relations: Record<string, GroupMemberRelation> = Object.fromEntries(
    members.map((m) => [m.user.userId, m.relation]),
  );
  const feedSection = !group.autoFriend ? (
    <OpenFeed items={openFeed} relations={relations} now={now} />
  ) : feed.length === 0 ? (
    <p className="text-caption border-divider border-t px-5 py-4 text-[13px] text-pretty">
      {GROUP_COPY.feedEmpty}
    </p>
  ) : (
    <div className="flex flex-col">
      {feed.map((item) => {
        const like = (reactionsBySession.get(item.sessionId) ?? []).find(
          (r) => r.emoji === LIKE_EMOJI,
        );
        return (
          <SessionCard
            key={item.sessionId}
            item={item}
            now={now}
            comments={commentsBySession.get(item.sessionId) ?? []}
            kudos={{ count: like?.count ?? 0, mine: like?.mine ?? false }}
            author={item.author}
          />
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-24">
      <main className="flex w-full max-w-md flex-col">
        {header}
        <GroupTabs
          leaderboard={leaderboard}
          feed={feedSection}
          members={<GroupMembers members={members} />}
          memberCount={members.length}
        />
      </main>
    </div>
  );
}
