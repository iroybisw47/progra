import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { ClockedInStrip } from "@/components/clocked-in-strip";
import { FeedLivePoll } from "@/components/feed-live-poll";
import { InviteShare } from "@/components/v2/invite-share";
import { HabitCheckoffCard } from "@/components/v2/habit-checkoff-card";
import { RecapFeedCard } from "@/components/v2/recap-feed-card";
import { SessionCard } from "@/components/v2/session-card";
import { Card, CardContent } from "@/components/ui/card";
import { getProfile } from "@/lib/auth/profile";
import {
  listClockedInNow,
  listFriendFeed,
  listFriendJoins,
  listRecapPosts,
  type FeedEntry,
} from "@/lib/db/feed";
import { listCommentsForSessions } from "@/lib/db/comments";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { listFriendHabitCheckoffs } from "@/lib/db/habit-feed";
import { listHabitKudos } from "@/lib/db/habit-social";
import { listRecapKudos, listRecapComments } from "@/lib/db/recap-social";
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { formatRelativeTime } from "@/lib/dates";

// The Feed tab (redesign). A live "clocked in now" strip plus friends' recent
// finished sessions. Unlike the pre-redesign Home feed, comment threads are
// collapsed to a count + one preview that link out to the session detail page —
// the whole card taps through to `/session/[id]` where reactions and the full
// thread live. RLS gates every read, so only shareable sessions arrive here.
export async function FeedV2() {
  // Reactions/comments are session-keyed, so they chain off listFriendFeed
  // alone — NOT the whole first wave. Chaining inside one Promise.all keeps
  // clocked-in/joins from gating them: total latency is max(feed→extras,
  // clockedIn, joins) instead of slowest(wave A) + slowest(wave B).
  const feedPromise = listFriendFeed();
  const commentsPromise = feedPromise.then((items) =>
    listCommentsForSessions(items.map((i) => i.sessionId))
  );
  const reactionsPromise = feedPromise.then((items) =>
    listReactionsForSessions(items.map((i) => i.sessionId))
  );
  // Recap kudos/comments chain off the recap posts the same way — keyed by post id.
  const recapPromise = listRecapPosts();
  const recapKudosPromise = recapPromise.then((items) =>
    listRecapKudos(items.map((i) => i.id))
  );
  const recapCommentsPromise = recapPromise.then((items) =>
    listRecapComments(items.map((i) => i.id))
  );
  // Habit kudos chain off the check-offs the same way — keyed by completion id.
  const habitPromise = listFriendHabitCheckoffs();
  const habitKudosPromise = habitPromise.then((items) =>
    listHabitKudos(items.map((i) => i.id))
  );
  const [
    sessionItems,
    clockedIn,
    joinItems,
    recapItems,
    commentsBySession,
    reactionsBySession,
    recapKudosById,
    recapCommentsById,
    habitItems,
    habitKudosById,
    viewerProfile,
  ] = await Promise.all([
    feedPromise,
    listClockedInNow(),
    listFriendJoins(),
    recapPromise,
    commentsPromise,
    reactionsPromise,
    recapKudosPromise,
    recapCommentsPromise,
    habitPromise,
    habitKudosPromise,
    // Own handle for the empty-state invite link (cache()-wrapped — free).
    getProfile(),
  ]);
  const now = Date.now();

  // Merge sessions + join announcements + recap posts + habit check-offs,
  // newest-first (sessions by end time, joins by when the member joined, recaps
  // and habit check-offs by when posted — both carry `postedAt`, so the final
  // branch covers the two).
  const sortAt = (e: FeedEntry) =>
    e.kind === "session"
      ? e.endedAt
      : e.kind === "join"
        ? e.joinedAt
        : e.postedAt;
  const entries: FeedEntry[] = [
    ...sessionItems,
    ...joinItems,
    ...recapItems,
    ...habitItems,
  ].sort((a, b) => sortAt(b) - sortAt(a));

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-28">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">Feed</h1>
          <p className="text-caption text-sm">
            What your friends have been working on.
          </p>
        </header>

        <FeedLivePoll />
        <ClockedInStrip items={clockedIn} serverNow={now} />

        {entries.length === 0 ? (
          clockedIn.length === 0 && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-8">
                <p className="text-caption text-center text-sm text-pretty">
                  Your feed&rsquo;s quiet — invite a friend and you&rsquo;ll see
                  each other show up.
                </p>
                {viewerProfile?.username && (
                  <InviteShare username={viewerProfile.username} />
                )}
                <Link
                  href="/friends"
                  className="text-caption hover:text-ink self-center text-xs font-medium"
                >
                  or find people already on Progra
                </Link>
              </CardContent>
            </Card>
          )
        ) : (
          entries.map((entry) => {
            // "Just joined Progra" announcement — lighter card, no
            // reactions/comments (those need a real session).
            if (entry.kind === "join") {
              return (
                <Card key={entry.id}>
                  <CardContent className="flex flex-col gap-2 py-4">
                    <div className="flex items-center gap-3">
                      <Link href={`/profile/${entry.author.username}`}>
                        <AvatarInitials
                          name={entry.author.displayName}
                          username={entry.author.username}
                          avatarUrl={entry.author.avatarUrl}
                          className="size-10 text-sm"
                        />
                      </Link>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm">
                          <Link
                            href={`/profile/${entry.author.username}`}
                            className="font-bold hover:underline"
                          >
                            {entry.author.displayName ||
                              `@${entry.author.username}`}
                          </Link>{" "}
                          <span className="text-caption">
                            just joined Progra!
                          </span>
                        </span>
                        <span className="text-faint text-xs">
                          {formatRelativeTime(entry.joinedAt, now)}
                        </span>
                      </div>
                    </div>
                    {entry.firstGoalTitle ? (
                      <p className="text-sm">
                        <span className="text-caption font-normal">
                          Their first goal is{" "}
                        </span>
                        <span className="font-medium">
                          {entry.firstGoalTitle}
                        </span>
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            }

            // Posted weekly recap — its own distinct card.
            if (entry.kind === "recap") {
              return (
                <RecapFeedCard
                  key={entry.id}
                  entry={entry}
                  now={now}
                  kudos={recapKudosById.get(entry.id) ?? { count: 0, mine: false }}
                  comments={recapCommentsById.get(entry.id) ?? []}
                />
              );
            }

            if (entry.kind === "habit") {
              return (
                <HabitCheckoffCard
                  key={entry.id}
                  entry={entry}
                  now={now}
                  kudos={
                    habitKudosById.get(entry.id) ?? { count: 0, mine: false }
                  }
                />
              );
            }

            const item = entry;
            const likeSummary = (
              reactionsBySession.get(item.sessionId) ?? []
            ).find((r) => r.emoji === LIKE_EMOJI);
            return (
              <SessionCard
                key={item.sessionId}
                item={item}
                now={now}
                comments={commentsBySession.get(item.sessionId) ?? []}
                kudos={{
                  count: likeSummary?.count ?? 0,
                  mine: likeSummary?.mine ?? false,
                }}
                author={item.author}
              />
            );
          })
        )}
      </main>
    </div>
  );
}

