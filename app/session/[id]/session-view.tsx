import Link from "next/link";
import { LockIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { CategoryMarker } from "@/components/category-marker";
import { CommentComposer } from "@/components/comment-composer";
import { DeleteCommentButton } from "@/components/delete-comment-button";
import { KudosButton } from "@/components/kudos-button";
import { ReportButton } from "@/components/report-button";
import { BackButton } from "@/components/v2/back-button";
import { entityColor, tint } from "@/lib/colors";
import type { CommentItem } from "@/lib/db/comments";
import type { SessionDetail } from "@/lib/db/session-detail";
import { formatRelativeTime } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";

// One post, in full. The feed card (components/v2/session-card.tsx) opens into
// this, so it speaks the same vocabulary at a larger scale — same author row,
// same "clocked into ◈ x for 2h" sub-line, same duration pill in the session's
// own colour — with the title in serif at 26px instead of 17 and the
// description and photo uncropped.
//
// No emoji palette: the post carries one like, the same kudos the feed leaves.
// Presentational on purpose — page.tsx does the loading, which is also what
// lets this render from fixtures.
export function SessionDetailView({
  detail,
  comments,
  kudos,
  now,
}: {
  detail: SessionDetail;
  comments: CommentItem[];
  kudos: { count: number; mine: boolean };
  now: number;
}) {
  const a = detail.attribution;
  const accent = entityColor(a?.color ?? null);
  const durationLabel = formatDuration(detail.workedMs);

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center gap-2.5 px-5">
          <BackButton />
          <span className="section-label">Session</span>
          <span className="flex-1" />
          {!detail.isOwn && (
            <ReportButton
              targetType="story"
              targetId={detail.sessionId}
              label="Report"
            />
          )}
        </header>

        {/* Author + when */}
        <div className="flex items-center gap-[11px] px-5 pt-4">
          <Link href={`/profile/${detail.author.username}`}>
            <AvatarInitials
              name={detail.author.displayName}
              username={detail.author.username}
              avatarUrl={detail.author.avatarUrl}
              className="size-[38px] text-sm"
            />
          </Link>
          <Link
            href={`/profile/${detail.author.username}`}
            className="text-body min-w-0 flex-1 truncate text-sm font-semibold"
          >
            {detail.author.displayName || `@${detail.author.username}`}
          </Link>
          {detail.endedAt != null && (
            <span className="text-faint shrink-0 text-xs">
              {formatRelativeTime(detail.endedAt, now)}
            </span>
          )}
        </div>

        {/* What it counts towards — the card's sub-line, wrapping rather than
            truncating. */}
        <div className="px-5 pt-2.5">
          <span className="text-caption flex flex-wrap items-center gap-x-1 text-[13px]">
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

        {/* The post */}
        <h1 className="text-ink px-5 pt-2.5 font-serif text-[26px] leading-[1.15] font-medium tracking-[-0.015em] text-pretty">
          {detail.title}
        </h1>
        {detail.description && (
          <p className="px-5 pt-2.5 text-[14.5px] leading-[1.6] text-pretty text-[var(--secondary-ink)]">
            {detail.description}
          </p>
        )}

        {/* Photo, whole. Reaching this page means the session is visible to us,
            so there's no separate gate on the photo.

            Raw <img>: the src is a short-lived signed URL into a private bucket
            that next/image can neither cache sanely nor reach without a
            remotePatterns allowlist. */}
        {detail.photoUrl && (
          <div className="px-5 pt-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={detail.photoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-auto w-full rounded-[14px]"
            />
          </div>
        )}

        {/* Duration in the session's own colour, and the one like. A private
            post shows a Private chip instead: nobody else can see it, so there
            is nothing to like. */}
        <div className="flex items-center gap-3.5 px-5 pt-4">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap tabular-nums"
            style={{ backgroundColor: tint(accent), color: accent }}
          >
            <span
              aria-hidden
              className="size-1.5 rounded-[2px]"
              style={{ backgroundColor: accent }}
            />
            {durationLabel}
          </span>
          <span className="flex-1" />
          {detail.isPrivate ? (
            <span className="text-caption flex items-center gap-1.5 text-[11px] font-semibold">
              <LockIcon className="size-3.5" />
              Private
            </span>
          ) : (
            <div className="border-hairline flex items-center rounded-full border p-0.5">
              <KudosButton
                sessionId={detail.sessionId}
                count={kudos.count}
                likedByMe={kudos.mine}
              />
            </div>
          )}
        </div>

        <div className="bg-track border-hairline mt-6 h-1.5 border-t" aria-hidden />

        {/* Comments */}
        <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
          <span className="section-label">Comments</span>
          <span className="flex-1" />
          {comments.length > 0 && (
            <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">
              {comments.length}
            </span>
          )}
        </div>

        {comments.length === 0 && (
          <p className="text-disabled border-divider border-t px-5 py-3 text-[13px]">
            No comments yet.
          </p>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className="border-divider flex items-start gap-2.5 border-t px-5 py-3"
          >
            <Link href={`/profile/${c.author.username}`} className="shrink-0">
              <AvatarInitials
                name={c.author.displayName}
                username={c.author.username}
                avatarUrl={c.author.avatarUrl}
                className="size-[26px] text-[10px]"
              />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/profile/${c.author.username}`}
                  className="text-body truncate text-[12.5px] font-semibold"
                >
                  {c.author.displayName || `@${c.author.username}`}
                </Link>
                <span className="text-faint shrink-0 text-[11px]">
                  {formatRelativeTime(c.createdAt, now)}
                </span>
              </div>
              <span className="text-[13.5px] leading-[1.5] break-words text-[var(--secondary-ink)]">
                {c.body}
              </span>
            </div>
            <span className="shrink-0 pt-0.5">
              {c.canDelete ? (
                <DeleteCommentButton commentId={c.id} />
              ) : (
                <ReportButton targetType="comment" targetId={c.id} />
              )}
            </span>
          </div>
        ))}

        <div className="border-divider border-t px-5 pt-3.5">
          <CommentComposer sessionId={detail.sessionId} />
        </div>
      </main>
    </div>
  );
}
