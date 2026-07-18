import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";
import { ClockedInStrip } from "@/components/clocked-in-strip";
import { CommentComposer } from "@/components/comment-composer";
import { DeleteCommentButton } from "@/components/delete-comment-button";
import { FeedLivePoll } from "@/components/feed-live-poll";
import { ReactionBar } from "@/components/reaction-bar";
import { ReportButton } from "@/components/report-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  listClockedInNow,
  listFriendFeed,
  listFriendJoins,
  type FeedEntry,
} from "@/lib/db/feed";
import { listCommentsForSessions } from "@/lib/db/comments";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { formatDuration } from "@/lib/duration";
import { formatRelativeTime } from "@/lib/dates";

// The Home feed (social v2): a live "clocked in now" strip plus friends' recent
// finished sessions, each with a comment thread. RLS gates every underlying
// read, so only shareable (non-private, accepted-friend) sessions and their
// visible comments reach here.
export async function Feed() {
  const [sessionItems, clockedIn, joinItems] = await Promise.all([
    listFriendFeed(),
    listClockedInNow(),
    listFriendJoins(),
  ]);
  // Reactions/comments are session-keyed, so only real sessions look them up.
  const sessionIds = sessionItems.map((i) => i.sessionId);
  const [commentsBySession, reactionsBySession] = await Promise.all([
    listCommentsForSessions(sessionIds),
    listReactionsForSessions(sessionIds),
  ]);
  const now = Date.now();

  // Merge sessions + join announcements, newest-first. Sessions sort by when
  // they ended, joins by when the member joined (onboarded_at).
  const sortAt = (e: FeedEntry) =>
    e.kind === "session" ? e.endedAt : e.joinedAt;
  const entries: FeedEntry[] = [...sessionItems, ...joinItems].sort(
    (a, b) => sortAt(b) - sortAt(a)
  );

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
          <p className="text-muted-foreground text-sm">
            What your friends have been working on.
          </p>
        </header>

        <FeedLivePoll />
        <ClockedInStrip items={clockedIn} serverNow={now} />

        {entries.length === 0 ? (
          clockedIn.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  Your feed is quiet. Add friends — their shared sessions show up
                  here.
                </p>
                <Link
                  href="/friends"
                  className={buttonVariants({
                    variant: "outline",
                    className: "h-10",
                  })}
                >
                  Find friends
                </Link>
              </CardContent>
            </Card>
          )
        ) : (
          entries.map((entry) => {
            // "Just joined Progra" announcement — a lighter card, no
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
                          className="size-10 text-sm"
                        />
                      </Link>
                      <div className="flex min-w-0 flex-col">
                        <Link
                          href={`/profile/${entry.author.username}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {entry.author.displayName ||
                            `@${entry.author.username}`}
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(entry.joinedAt, now)}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm">
                      <span className="font-medium">Just joined Progra!</span>
                      {entry.firstGoalTitle ? (
                        <>
                          {" "}
                          Their first goal is{" "}
                          <span className="text-muted-foreground">
                            {entry.firstGoalTitle}
                          </span>
                          .
                        </>
                      ) : null}
                    </p>
                  </CardContent>
                </Card>
              );
            }

            const item = entry;
            return (
              <Card key={item.sessionId}>
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${item.author.username}`}>
                      <AvatarInitials
                        name={item.author.displayName}
                        username={item.author.username}
                        className="size-10 text-sm"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/profile/${item.author.username}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {item.author.displayName || `@${item.author.username}`}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(item.endedAt, now)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {item.title}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      {item.attribution ? (
                        <span className="text-muted-foreground text-xs">
                          {item.attribution.isGoal ? "Goal · " : ""}
                          {item.attribution.text}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground font-mono text-sm tabular-nums">
                        {formatDuration(item.workedMs)}
                      </span>
                    </span>
                  </div>

                  {item.description ? (
                    <p className="text-muted-foreground line-clamp-3 text-sm leading-snug">
                      {item.description}
                    </p>
                  ) : null}

                  <ReactionBar
                    sessionId={item.sessionId}
                    reactions={reactionsBySession.get(item.sessionId) ?? []}
                  />

                  {/* Comment thread */}
                  <div className="border-border/60 flex flex-col gap-2 border-t pt-3">
                    {(commentsBySession.get(item.sessionId) ?? []).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Link
                          href={`/profile/${c.author.username}`}
                          className="shrink-0 font-medium hover:underline"
                        >
                          {c.author.displayName || `@${c.author.username}`}
                        </Link>
                        <span className="min-w-0 flex-1 break-words">
                          {c.body}
                        </span>
                        {c.canDelete ? (
                          <DeleteCommentButton commentId={c.id} />
                        ) : (
                          <ReportButton targetType="comment" targetId={c.id} />
                        )}
                      </div>
                    ))}
                    <CommentComposer sessionId={item.sessionId} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
