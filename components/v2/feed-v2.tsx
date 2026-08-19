import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { ClockedInStrip } from "@/components/clocked-in-strip";
import { FeedLivePoll } from "@/components/feed-live-poll";
import { InviteShare } from "@/components/v2/invite-share";
import { RecapFeedCard } from "@/components/v2/recap-feed-card";
import { SessionCard } from "@/components/v2/session-card";
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
import { listRecapKudos, listRecapComments } from "@/lib/db/recap-social";
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { formatRelativeTime } from "@/lib/dates";

// The Feed tab (redesign). A live "clocked in now" strip plus friends' recent
// finished sessions. Unlike the pre-redesign Home feed, comment threads are
// collapsed to a count + one preview that link out to the session detail page —
// the whole card taps through to `/session/[id]` where the post and the full
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
  const [
    sessionItems,
    clockedIn,
    joinItems,
    recapItems,
    commentsBySession,
    reactionsBySession,
    recapKudosById,
    recapCommentsById,
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
    // Own handle for the empty-state invite link (cache()-wrapped — free).
    getProfile(),
  ]);
  const now = Date.now();

  // Merge sessions + join announcements + recap posts, newest-first (sessions by
  // end time, joins by when the member joined, recaps by when posted).
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
  ].sort((a, b) => sortAt(b) - sortAt(a));

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="px-5">
          <span className="section-label">Feed</span>
        </header>

        <FeedLivePoll />
        <ClockedInStrip items={clockedIn} serverNow={now} />

        {entries.length === 0 ? (
          clockedIn.length === 0 && (
            <div className="flex flex-col gap-3 px-5 py-10">
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
            </div>
          )
        ) : (
          entries.map((entry) => {
            // "Just joined Progra" announcement — lighter card, no
            // reactions/comments (those need a real session).
            if (entry.kind === "join") {
              return (
                <div
                  key={entry.id}
                  className="border-hairline flex flex-col gap-2 border-b px-5 py-4"
                >
                  <div className="flex items-center gap-[11px]">
                    <Link href={`/profile/${entry.author.username}`}>
                      <AvatarInitials
                        name={entry.author.displayName}
                        username={entry.author.username}
                        avatarUrl={entry.author.avatarUrl}
                        className="size-[34px] text-xs"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={`/profile/${entry.author.username}`}
                        className="text-body truncate text-[13px] leading-[1.25] font-semibold"
                      >
                        {entry.author.displayName ||
                          `@${entry.author.username}`}
                      </Link>
                      <span className="text-faint text-[11px] leading-[1.3]">
                        just joined Progra
                      </span>
                    </div>
                    <span className="text-disabled shrink-0 text-[11px]">
                      {formatRelativeTime(entry.joinedAt, now)}
                    </span>
                  </div>
                  {entry.firstGoalTitle ? (
                    <p className="text-[13px] leading-[1.5] text-[var(--secondary-ink)]">
                      Their first goal is{" "}
                      <span className="text-body font-semibold">
                        {entry.firstGoalTitle}
                      </span>
                    </p>
                  ) : null}
                </div>
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

