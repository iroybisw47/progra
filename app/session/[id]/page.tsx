import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { CommentComposer } from "@/components/comment-composer";
import { DeleteCommentButton } from "@/components/delete-comment-button";
import { ReactionBar } from "@/components/reaction-bar";
import { ReportButton } from "@/components/report-button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { REDESIGN } from "@/lib/flags";
import { getSessionForViewer } from "@/lib/db/session-detail";
import { listCommentsForSessions } from "@/lib/db/comments";
import { listReactionsForSessions } from "@/lib/db/reactions";
import { formatDuration } from "@/lib/duration";
import { formatRelativeDay, formatTime } from "@/lib/dates";

// A single session's detail page (redesign only). Photos, reactions, and the
// full comment thread. Visibility is enforced by RLS in getSessionForViewer, so
// a session the viewer can't see 404s.
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!REDESIGN) notFound();
  await requireUser();
  const { id } = await params;

  const detail = await getSessionForViewer(id);
  if (!detail) notFound();

  const [commentsBySession, reactionsBySession] = await Promise.all([
    listCommentsForSessions([detail.sessionId]),
    listReactionsForSessions([detail.sessionId]),
  ]);
  const comments = commentsBySession.get(detail.sessionId) ?? [];
  const reactions = reactionsBySession.get(detail.sessionId) ?? [];
  const now = Date.now();
  const hasPhotos = detail.beforeUrl || detail.afterUrl;

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-6 pb-28">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex items-center justify-between">
          <Link
            href="/feed"
            aria-label="Back"
            className="text-caption hover:text-ink border-hairline flex size-9 items-center justify-center rounded-full border"
          >
            <ChevronLeftIcon className="size-4" />
          </Link>
          {!detail.isOwn && (
            <ReportButton
              targetType="story"
              targetId={detail.sessionId}
              label="Report"
            />
          )}
        </header>

        {/* Author + attribution */}
        <div className="flex items-center gap-3">
          <Link href={`/profile/${detail.author.username}`}>
            <AvatarInitials
              name={detail.author.displayName}
              username={detail.author.username}
              className="size-11 text-base"
            />
          </Link>
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/profile/${detail.author.username}`}
              className="truncate text-sm font-bold hover:underline"
            >
              {detail.author.displayName || `@${detail.author.username}`}
            </Link>
            {detail.endedAt != null && (
              <span className="text-faint text-xs">
                {formatRelativeDay(new Date(detail.endedAt), new Date(now))}
                {" · "}
                {formatTime(new Date(detail.endedAt))}
              </span>
            )}
          </div>
        </div>

        {/* Task + duration */}
        <Card>
          <CardContent className="flex flex-col gap-2 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-base font-bold text-pretty">
                {detail.isGoal ? (
                  <span className="text-caption font-normal">Goal: </span>
                ) : null}
                {detail.label}
              </span>
              <span className="text-body shrink-0 font-mono text-sm tabular-nums">
                {formatDuration(detail.workedMs)}
              </span>
            </div>
            {detail.description && (
              <p className="text-body text-sm text-pretty">
                {detail.description}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Before / after */}
        {hasPhotos && (
          <div className="grid grid-cols-2 gap-2">
            {detail.beforeUrl && (
              <figure className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detail.beforeUrl}
                  alt="Before"
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <figcaption className="text-caption text-center text-xs uppercase tracking-wider">
                  Before
                </figcaption>
              </figure>
            )}
            {detail.afterUrl && (
              <figure className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detail.afterUrl}
                  alt="After"
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <figcaption className="text-caption text-center text-xs uppercase tracking-wider">
                  After
                </figcaption>
              </figure>
            )}
          </div>
        )}

        {/* Reactions */}
        <ReactionBar sessionId={detail.sessionId} reactions={reactions} />

        {/* Comments */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold">
            {comments.length > 0
              ? `${comments.length} comment${comments.length === 1 ? "" : "s"}`
              : "Comments"}
          </h2>
          <div className="flex flex-col gap-3">
            {comments.length === 0 && (
              <p className="text-caption text-sm">No comments yet.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                <Link href={`/profile/${c.author.username}`}>
                  <AvatarInitials
                    name={c.author.displayName}
                    username={c.author.username}
                    className="size-7 text-[10px]"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/profile/${c.author.username}`}
                    className="text-xs font-bold hover:underline"
                  >
                    {c.author.displayName || `@${c.author.username}`}
                  </Link>
                  <span className="text-body break-words">{c.body}</span>
                </div>
                {c.canDelete ? (
                  <DeleteCommentButton commentId={c.id} />
                ) : (
                  <ReportButton targetType="comment" targetId={c.id} />
                )}
              </div>
            ))}
          </div>
          <CommentComposer sessionId={detail.sessionId} />
        </section>
      </main>
    </div>
  );
}
