"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { addRecapComment, deleteRecapComment } from "@/app/actions/recap-social";
import { AvatarInitials } from "@/components/avatar-initials";
import { track } from "@/lib/analytics";
import { formatRelativeTime } from "@/lib/dates";
import type { RecapComment } from "@/lib/db/recap-social";
import { useLocationHash } from "@/lib/hooks";
import { COMMENT_MAX_LENGTH } from "@/lib/social/comments";
import { commentAnchorId, parseCommentAnchor } from "@/lib/social/comment-threads";
import { cn } from "@/lib/utils";

// The comment thread on a posted weekly review (/review/[id]), in the session
// page's look (CommentRow). A push or panel row lands on #c-<id>: that comment
// scrolls into view with a brief tint. Comments are flat (no replies here).
export function RecapThread({ comments, now }: { comments: RecapComment[]; now: number }) {
  const anchorId = parseCommentAnchor(useLocationHash());

  useEffect(() => {
    if (!anchorId) return;
    document.getElementById(commentAnchorId(anchorId))?.scrollIntoView({ block: "center" });
  }, [anchorId]);

  if (comments.length === 0) {
    return <p className="text-disabled border-divider border-t px-5 py-3 text-[13px]">No comments yet.</p>;
  }
  return comments.map((c) => (
    <RecapCommentRow key={c.id} comment={c} now={now} highlighted={c.id === anchorId} />
  ));
}

function RecapCommentRow({
  comment: c,
  now,
  highlighted,
}: {
  comment: RecapComment;
  now: number;
  highlighted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const name = c.author.displayName || `@${c.author.username}`;

  function remove() {
    startTransition(async () => {
      const r = await deleteRecapComment(c.id);
      if ("error" in r) toast.error(r.error);
    });
  }

  return (
    <div
      id={commentAnchorId(c.id)}
      className={cn(
        "border-divider flex scroll-mt-20 items-start gap-2.5 border-t px-5 py-3 transition-colors duration-700",
        highlighted && "bg-brand/5"
      )}
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
          <Link href={`/profile/${c.author.username}`} className="text-body truncate text-[12.5px] font-semibold">
            {name}
          </Link>
          <span className="text-faint shrink-0 text-[11px]">{formatRelativeTime(c.createdAt, now)}</span>
        </div>
        <span className="text-secondary-ink text-[13.5px] leading-[1.5] break-words">{c.body}</span>
      </div>
      {c.canDelete && (
        <button
          type="button"
          aria-label="Delete comment"
          disabled={pending}
          onClick={remove}
          className="text-disabled hover:text-ink shrink-0 pt-0.5 transition-colors disabled:opacity-50"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// Add a comment to a posted weekly review — the session page's composer.
export function RecapCommentComposer({ recapId }: { recapId: string }) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const body = value.trim();
    if (!body) return;
    startTransition(async () => {
      const r = await addRecapComment(recapId, body);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      track("comment_given", { recap_ref: recapId, depth: "root" });
      setValue("");
    });
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* 16px: anything smaller makes iOS zoom in on focus. */}
      <input
        className="border-control-border text-ink focus:border-brand placeholder:text-disabled h-11 min-w-0 flex-1 rounded-[13px] border-[1.5px] px-3.5 text-base outline-none disabled:opacity-50"
        placeholder="Add a comment…"
        maxLength={COMMENT_MAX_LENGTH}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
      />
      <button
        type="submit"
        disabled={pending || value.trim().length === 0}
        className="bg-brand text-primary-foreground h-11 shrink-0 rounded-[13px] px-4 text-sm font-semibold transition-transform active:scale-[.97] disabled:opacity-40"
      >
        Post
      </button>
    </form>
  );
}
