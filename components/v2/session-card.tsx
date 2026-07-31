import Link from "next/link";
import { ClockIcon, LockIcon, MessageCircleIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { CategoryMarker } from "@/components/category-marker";
import { KudosButton } from "@/components/kudos-button";
import { ReportButton } from "@/components/report-button";
import { Card } from "@/components/ui/card";
import type { CommentItem } from "@/lib/db/comments";
import type { SessionCardItem } from "@/lib/db/feed";
import type { PublicUser } from "@/lib/db/friends";
import { formatDuration } from "@/lib/duration";
import { formatRelativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

// One finished session, rendered identically on the Feed, the You tab, and
// profile pages. Extracted from FeedV2's inline card: the profile surface used
// to hand-roll its own and had drifted into showing only a label + duration,
// losing the title, description, category and the whole social row.
//
// Two surface differences, both opt-in so the feed keeps its exact appearance:
//
// - `author` omitted → no avatar/name row. The profile surfaces already show
//   whose page it is in the header, so repeating it on every card is noise. The
//   "clocked into ◈ x for 2h" sub-line and the timestamp still render.
// - `canReport` → shows the story report control. The feed deliberately has
//   none (reporting a story lives on /session/[id]), but profiles do, so this
//   preserves that moderation affordance rather than silently dropping it.
export function SessionCard({
  item,
  now,
  comments,
  kudos,
  author,
  canReport = false,
}: {
  item: SessionCardItem;
  now: number;
  comments: CommentItem[];
  kudos: { count: number; mine: boolean };
  author?: PublicUser;
  canReport?: boolean;
}) {
  const preview = comments[0];
  const a = item.attribution;
  const durationLabel = formatDuration(item.workedMs);

  // Timestamp, plus the report control when the surface allows it. Sits hard
  // right on whichever row it shares.
  const meta = canReport ? (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-faint text-xs">
        {formatRelativeTime(item.endedAt, now)}
      </span>
      <ReportButton targetType="story" targetId={item.sessionId} />
    </span>
  ) : (
    // Without a report control this is the feed's original single span — no
    // extra wrapper, so feed markup stays byte-identical.
    <span className="text-faint shrink-0 text-xs">
      {formatRelativeTime(item.endedAt, now)}
    </span>
  );

  // "clocked into ⟨marker⟩ {target} for {dur}" — a full sentence that wraps
  // rather than truncating.
  const subLine = (extra?: string) => (
    <span
      className={cn(
        "text-caption flex flex-wrap items-center gap-x-1 text-xs",
        extra
      )}
    >
      {a ? (
        <>
          clocked into
          <CategoryMarker isGoal={a.isGoal} color={a.color} />
          <span className="text-body font-medium break-words">{a.text}</span>
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
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col">
        {/* Header: who + "clocked into ⟨marker⟩ {target} for {dur}" */}
        <div className="flex items-start gap-3 px-4 pt-4">
          {author && (
            <Link href={`/profile/${author.username}`}>
              <AvatarInitials
                name={author.displayName}
                username={author.username}
                avatarUrl={author.avatarUrl}
                className="size-10 text-sm"
              />
            </Link>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {author ? (
              <>
                {/* Name left, timestamp hard right; sub-line beneath. */}
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/profile/${author.username}`}
                    className="truncate text-sm font-bold hover:underline"
                  >
                    {author.displayName || `@${author.username}`}
                  </Link>
                  {meta}
                </div>
                {subLine()}
              </>
            ) : (
              // No name row for the timestamp to hang off, so the sub-line
              // takes that row instead — "clocked into x" now sits on the same
              // baseline as "3h ago" rather than on a line below an empty one.
              <div className="flex items-baseline justify-between gap-2">
                {subLine("min-w-0 flex-1")}
                {meta}
              </div>
            )}
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

        {/* Footer — duration pill + kudos/comments. A private session shows a
            Private chip instead: nobody else can see the post, so there is
            nothing to like and an "Add a comment" prompt would be a lie. */}
        <div className="border-divider flex items-center justify-between gap-3 border-t px-4 py-2.5">
          <span className="bg-brand/10 text-brand inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 font-mono text-xs font-semibold tabular-nums">
            <ClockIcon className="size-3" />
            {durationLabel}
          </span>
          {item.isPrivate ? (
            <span className="text-caption flex items-center gap-1.5 text-xs font-medium">
              <LockIcon className="size-3.5" />
              Private
            </span>
          ) : (
            <div className="flex items-center gap-3.5">
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
              <KudosButton
                sessionId={item.sessionId}
                count={kudos.count}
                likedByMe={kudos.mine}
              />
            </div>
          )}
        </div>

        {/* Comment preview → session detail (kept alongside the count). Omitted
            on private sessions, which can never have comments. */}
        {!item.isPrivate && (
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
                  <span className="text-body break-words">{preview.body}</span>
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
        )}
      </div>
    </Card>
  );
}
