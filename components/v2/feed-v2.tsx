import Link from "next/link";
import { MessageCircleIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { ClockedInStrip } from "@/components/clocked-in-strip";
import { FeedLivePoll } from "@/components/feed-live-poll";
import { ReactionBar } from "@/components/reaction-bar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listClockedInNow, listFriendFeed } from "@/lib/db/feed";
import { listCommentsForSessions } from "@/lib/db/comments";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { formatDuration } from "@/lib/duration";
import { formatRelativeTime } from "@/lib/dates";

// The Feed tab (redesign). A live "clocked in now" strip plus friends' recent
// finished sessions. Unlike the pre-redesign Home feed, comment threads are
// collapsed to a count + one preview that link out to the session detail page —
// the whole card taps through to `/session/[id]` where reactions and the full
// thread live. RLS gates every read, so only shareable sessions arrive here.
export async function FeedV2() {
  const [items, clockedIn] = await Promise.all([
    listFriendFeed(),
    listClockedInNow(),
  ]);
  const sessionIds = items.map((i) => i.sessionId);
  const [commentsBySession, reactionsBySession] = await Promise.all([
    listCommentsForSessions(sessionIds),
    listReactionsForSessions(sessionIds),
  ]);
  const now = Date.now();

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

        {items.length === 0 ? (
          clockedIn.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-caption text-sm">
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
          items.map((item) => {
            const comments = commentsBySession.get(item.sessionId) ?? [];
            const preview = comments[0];
            return (
              <Card key={item.sessionId}>
                <CardContent className="flex flex-col gap-3 py-4">
                  {/* Author row */}
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${item.author.username}`}>
                      <AvatarInitials
                        name={item.author.displayName}
                        username={item.author.username}
                        className="size-10 text-sm"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm">
                        <Link
                          href={`/profile/${item.author.username}`}
                          className="font-bold hover:underline"
                        >
                          {item.author.displayName || `@${item.author.username}`}
                        </Link>{" "}
                        <span className="text-caption">finished</span>
                      </span>
                      <span className="text-faint text-xs">
                        {formatRelativeTime(item.endedAt, now)}
                      </span>
                    </div>
                  </div>

                  {/* Tap-through to session detail */}
                  <Link
                    href={`/session/${item.sessionId}`}
                    className="hover:bg-track/40 -mx-1 flex items-baseline justify-between gap-2 rounded-lg px-1 py-1 transition-colors"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {item.isGoal ? (
                        <span className="text-caption font-normal">Goal: </span>
                      ) : null}
                      {item.label}
                    </span>
                    <span className="text-body shrink-0 font-mono text-sm tabular-nums">
                      {formatDuration(item.workedMs)}
                    </span>
                  </Link>

                  <ReactionBar
                    sessionId={item.sessionId}
                    reactions={reactionsBySession.get(item.sessionId) ?? []}
                  />

                  {/* Collapsed comment thread → session detail */}
                  <Link
                    href={`/session/${item.sessionId}`}
                    className="border-divider flex flex-col gap-1.5 border-t pt-3"
                  >
                    {preview ? (
                      <>
                        <span className="text-sm">
                          <span className="font-bold">
                            {preview.author.displayName ||
                              `@${preview.author.username}`}
                          </span>{" "}
                          <span className="text-body break-words">
                            {preview.body}
                          </span>
                        </span>
                        {comments.length > 1 && (
                          <span className="text-caption text-xs">
                            View all {comments.length} comments
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-caption flex items-center gap-1.5 text-xs">
                        <MessageCircleIcon className="size-3.5" />
                        Add a comment
                      </span>
                    )}
                  </Link>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
