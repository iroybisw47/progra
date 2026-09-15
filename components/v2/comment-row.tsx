import Link from "next/link";
import type { ReactNode } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { DeleteCommentButton } from "@/components/delete-comment-button";
import { ReportButton } from "@/components/report-button";
import type { CommentItem } from "@/lib/db/comments";
import type { PublicUser } from "@/lib/db/friends";
import { formatRelativeTime } from "@/lib/dates";
import { commentAnchorId } from "@/lib/social/comment-threads";
import { cn } from "@/lib/utils";

// One comment on the session page. Presentational: the server renders it in
// the flat list (replies off), the client thread renders it for roots and
// replies (replies on).
//
// A root is the original row, unchanged. A reply sits one step in — its
// avatar under the root's TEXT column (20px gutter + 26px avatar + 10px gap =
// 56px), smaller, and without the hairline between rows, so a thread reads as
// one unit.
//
// Every row carries id="c-{id}": a push or panel row links to
// /session/{id}#c-{commentId} and lands on it.
export function CommentRow({
  comment: c,
  now,
  variant = "root",
  mention = null,
  replySlot,
  replyCount = 0,
  highlighted = false,
}: {
  comment: CommentItem;
  now: number;
  variant?: "root" | "reply";
  // "@name" before the body — only for a reply to a reply (see replyMention).
  mention?: PublicUser | null;
  // The Reply control, rendered after the timestamp.
  replySlot?: ReactNode;
  // A root's reply count, so deleting it can warn that they go too.
  replyCount?: number;
  // Brief tint on the comment a deep link landed on.
  highlighted?: boolean;
}) {
  const reply = variant === "reply";
  const name = c.author.displayName || `@${c.author.username}`;

  return (
    <div
      id={commentAnchorId(c.id)}
      className={cn(
        "flex scroll-mt-20 items-start transition-colors duration-700",
        reply
          ? "gap-2 py-2 pr-5 pl-[56px]"
          : "border-divider gap-2.5 border-t px-5 py-3",
        highlighted && "bg-brand/5"
      )}
    >
      <Link href={`/profile/${c.author.username}`} className="shrink-0">
        <AvatarInitials
          name={c.author.displayName}
          username={c.author.username}
          avatarUrl={c.author.avatarUrl}
          className={reply ? "size-5 text-[8px]" : "size-[26px] text-[10px]"}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/profile/${c.author.username}`}
            className={cn(
              "text-body truncate font-semibold",
              reply ? "text-[12px]" : "text-[12.5px]"
            )}
          >
            {name}
          </Link>
          <span className="text-faint shrink-0 text-[11px]">
            {formatRelativeTime(c.createdAt, now)}
          </span>
          {replySlot}
        </div>
        <span
          className={cn(
            "leading-[1.5] break-words text-secondary-ink",
            reply ? "text-[13px]" : "text-[13.5px]"
          )}
        >
          {mention && (
            <>
              <Link
                href={`/profile/${mention.username}`}
                className="text-brand font-semibold"
              >
                @{mention.username}
              </Link>{" "}
            </>
          )}
          {c.body}
        </span>
      </div>
      <span className="shrink-0 pt-0.5">
        {c.canDelete ? (
          <DeleteCommentButton commentId={c.id} replyCount={replyCount} />
        ) : (
          <ReportButton targetType="comment" targetId={c.id} />
        )}
      </span>
    </div>
  );
}
