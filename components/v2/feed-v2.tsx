import Link from "next/link";
import { ClockIcon, MessageCircleIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { CategoryMarker } from "@/components/category-marker";
import { ClockedInStrip } from "@/components/clocked-in-strip";
import { FeedLivePoll } from "@/components/feed-live-poll";
import { KudosButton } from "@/components/kudos-button";
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
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { formatDuration } from "@/lib/duration";
import { formatRelativeTime } from "@/lib/dates";

// The Feed tab (redesign). A live "clocked in now" strip plus friends' recent
// finished sessions. Unlike the pre-redesign Home feed, comment threads are
// collapsed to a count + one preview that link out to the session detail page —
// the whole card taps through to `/session/[id]` where reactions and the full
// thread live. RLS gates every read, so only shareable sessions arrive here.
export async function FeedV2() {
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

  // Merge sessions + join announcements, newest-first (sessions by end time,
  // joins by when the member joined).
  const sortAt = (e: FeedEntry) =>
    e.kind === "session" ? e.endedAt : e.joinedAt;
  const entries: FeedEntry[] = [...sessionItems, ...joinItems].sort(
    (a, b) => sortAt(b) - sortAt(a)
  );

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

            const item = entry;
            const comments = commentsBySession.get(item.sessionId) ?? [];
            const preview = comments[0];
            const a = item.attribution;
            const durationLabel = formatDuration(item.workedMs);
            const likeSummary = (
              reactionsBySession.get(item.sessionId) ?? []
            ).find((r) => r.emoji === LIKE_EMOJI);
            return (
              <Card key={item.sessionId} className="overflow-hidden">
                <div className="flex flex-col">
                  {/* Header: who + "clocked into ⟨marker⟩ {target} for {dur}" */}
                  <div className="flex items-start gap-3 px-4 pt-4">
                    <Link href={`/profile/${item.author.username}`}>
                      <AvatarInitials
                        name={item.author.displayName}
                        username={item.author.username}
                        className="size-10 text-sm"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      {/* Top line: name left, timestamp hard right. */}
                      <div className="flex items-baseline justify-between gap-2">
                        <Link
                          href={`/profile/${item.author.username}`}
                          className="truncate text-sm font-bold hover:underline"
                        >
                          {item.author.displayName ||
                            `@${item.author.username}`}
                        </Link>
                        <span className="text-faint shrink-0 text-xs">
                          {formatRelativeTime(item.endedAt, now)}
                        </span>
                      </div>
                      {/* Sub-line: full sentence, wraps rather than truncating. */}
                      <span className="text-caption flex flex-wrap items-center gap-x-1 text-xs">
                        {a ? (
                          <>
                            clocked into
                            <CategoryMarker isGoal={a.isGoal} color={a.color} />
                            <span className="text-body font-medium break-words">
                              {a.text}
                            </span>
                          </>
                        ) : (
                          <>clocked in</>
                        )}
                        <span>
                          for{" "}
                          <span className="text-body font-medium tabular-nums">
                            {durationLabel}
                          </span>
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Body: title + description, taps through to the detail. */}
                  <Link
                    href={`/session/${item.sessionId}`}
                    className="hover:bg-track/30 flex flex-col gap-1 px-4 py-3 transition-colors"
                  >
                    <span className="text-lg font-medium leading-snug tracking-[-0.01em]">
                      {item.title}
                    </span>
                    {item.description ? (
                      <p className="text-body line-clamp-3 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    ) : null}
                  </Link>

                  {/* Photo — full-bleed band. Raw <img>: the src is a short-lived
                      signed URL into a private bucket that next/image can neither
                      cache sanely nor reach without a remotePatterns allowlist. */}
                  {item.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full object-cover"
                    />
                  )}

                  {/* Footer — duration pill + kudos/comments */}
                  <div className="border-divider flex items-center justify-between gap-3 border-t px-4 py-2.5">
                    <span className="bg-brand/10 text-brand inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 font-mono text-xs font-semibold tabular-nums">
                      <ClockIcon className="size-3" />
                      {durationLabel}
                    </span>
                    <div className="flex items-center gap-3.5">
                      <KudosButton
                        sessionId={item.sessionId}
                        count={likeSummary?.count ?? 0}
                        likedByMe={likeSummary?.mine ?? false}
                      />
                      <Link
                        href={`/session/${item.sessionId}`}
                        className="text-caption hover:text-body flex items-center gap-1.5 text-xs font-medium"
                        aria-label={`${comments.length} comments`}
                      >
                        <MessageCircleIcon className="size-4" />
                        {comments.length > 0 && (
                          <span className="tabular-nums">{comments.length}</span>
                        )}
                      </Link>
                    </div>
                  </div>

                  {/* Comment preview → session detail (kept alongside the count) */}
                  <Link
                    href={`/session/${item.sessionId}`}
                    className="border-divider flex flex-col gap-1.5 border-t px-4 py-3"
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
                </div>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
