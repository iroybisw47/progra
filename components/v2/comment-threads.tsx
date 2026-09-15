"use client";

import { ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { addReply } from "@/app/actions/comments";
import { CommentRow } from "@/components/v2/comment-row";
import { track } from "@/lib/analytics";
import type { CommentItem } from "@/lib/db/comments";
import { useLocationHash } from "@/lib/hooks";
import {
  commentAnchorId,
  parseCommentAnchor,
  replyMention,
  splitReplies,
  threadOf,
  type CommentThread,
} from "@/lib/social/comment-threads";
import { COMMENT_MAX_LENGTH } from "@/lib/social/comments";
import { cn } from "@/lib/utils";

type ReplyTarget = { id: string; rootId: string; name: string; isRoot: boolean };

const replyButtonId = (commentId: string) => `reply-btn-${commentId}`;

// The session page's comments, threaded one level deep (COMMENT_REPLIES).
//
// Reply opens a box INLINE, under the thread being answered — you never lose
// sight of what you're replying to, and nothing has to be sticky above the
// iOS keyboard. One box at a time; the bottom composer stays for new
// top-level comments.
//
// A thread of four or more replies collapses to its first two. A deep link to
// a comment (a push or a panel row → #c-{id}) expands its thread and scrolls
// to it — the hash is read through useSyncExternalStore ("" on the server),
// so this needs no state set in an effect.
export function CommentThreads({
  sessionId,
  threads,
  now,
}: {
  sessionId: string;
  threads: CommentThread<CommentItem>[];
  now: number;
}) {
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  // Kept when switching which comment you're answering; cleared on post/cancel.
  const [draft, setDraft] = useState("");
  // An explicit open/close per thread; otherwise a thread is open only if a
  // deep link points into it.
  const [openThreads, setOpenThreads] = useState<Map<string, boolean>>(new Map());
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollToAfterPost = useRef<string | null>(null);

  const anchorId = parseCommentAnchor(useLocationHash());
  const anchorRoot = anchorId ? threadOf(threads, anchorId) : null;

  // Deep link: the thread is rendered open by now; bring the comment into view.
  useEffect(() => {
    if (!anchorId) return;
    document
      .getElementById(commentAnchorId(anchorId))
      ?.scrollIntoView({ block: "center" });
  }, [anchorId]);

  // A posted reply arrives with the revalidated props; scroll to it once it has.
  useEffect(() => {
    const id = scrollToAfterPost.current;
    if (!id) return;
    const el = document.getElementById(commentAnchorId(id));
    if (!el) return;
    scrollToAfterPost.current = null;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [threads]);

  // Opening (or retargeting) the box focuses it.
  useEffect(() => {
    if (!replyTo) return;
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "nearest" });
  }, [replyTo]);

  const isOpen = (rootId: string) => openThreads.get(rootId) ?? rootId === anchorRoot;
  const setOpen = (rootId: string, open: boolean) =>
    setOpenThreads((prev) => new Map(prev).set(rootId, open));

  function startReply(c: CommentItem, rootId: string) {
    track("comment_reply_opened");
    setReplyTo({
      id: c.id,
      rootId,
      name: c.author.displayName || `@${c.author.username}`,
      isRoot: c.id === rootId,
    });
  }

  function cancel() {
    const from = replyTo?.id;
    setReplyTo(null);
    setDraft("");
    if (from) document.getElementById(replyButtonId(from))?.focus();
  }

  function submit(target: ReplyTarget) {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const r = await addReply(sessionId, target.id, body);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      track("comment_reply_posted", { depth: target.isRoot ? "root" : "reply" });
      // The new reply is the thread's newest — open it, or it'd land hidden.
      setOpen(target.rootId, true);
      scrollToAfterPost.current = r.commentId;
      setReplyTo(null);
      setDraft("");
    });
  }

  const replyButton = (c: CommentItem, rootId: string) => {
    const name = c.author.displayName || `@${c.author.username}`;
    return (
      <button
        type="button"
        id={replyButtonId(c.id)}
        aria-label={`Reply to ${name}`}
        onClick={() => startReply(c, rootId)}
        className="text-faint hover:text-ink -my-1 shrink-0 px-1 py-1 text-[11px] font-semibold transition-colors"
      >
        Reply
      </button>
    );
  };

  return (
    <>
      {threads.map(({ root, replies }) => {
        const open = isOpen(root.id);
        const { shown, hiddenCount } = splitReplies(replies, open);
        const collapsible = splitReplies(replies, false).hiddenCount > 0;
        const boxHere = replyTo?.rootId === root.id;

        return (
          <div key={root.id}>
            <CommentRow
              comment={root}
              now={now}
              replyCount={replies.length}
              highlighted={anchorId === root.id}
              replySlot={replyButton(root, root.id)}
            />
            {replies.length > 0 && (
              <div id={`replies-${root.id}`} className="pb-1">
                {shown.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    now={now}
                    variant="reply"
                    mention={replyMention(c)}
                    highlighted={anchorId === c.id}
                    replySlot={replyButton(c, root.id)}
                  />
                ))}
                {collapsible && (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`replies-${root.id}`}
                    onClick={() => setOpen(root.id, !open)}
                    className="text-caption hover:text-ink flex items-center gap-2 py-1.5 pr-5 pl-[56px] text-[11px] font-semibold transition-colors"
                  >
                    <span aria-hidden className="bg-hairline h-px w-5" />
                    {open
                      ? "Hide replies"
                      : `View ${hiddenCount} more ${hiddenCount === 1 ? "reply" : "replies"}`}
                    <ChevronDownIcon
                      aria-hidden
                      className={cn("size-3 transition-transform", open && "rotate-180")}
                      strokeWidth={2.4}
                    />
                  </button>
                )}
              </div>
            )}

            {boxHere && replyTo && (
              <div className="flex flex-col gap-1.5 pt-1 pr-5 pb-3 pl-[56px]">
                <div className="text-faint flex items-center gap-2 text-[11px]">
                  <span className="min-w-0 truncate">
                    Replying to{" "}
                    <span className="text-body font-semibold">{replyTo.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={cancel}
                    className="text-caption hover:text-ink shrink-0 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(replyTo);
                  }}
                >
                  {/* 16px (text-base): anything smaller makes iOS zoom the
                      page in on focus. */}
                  <input
                    ref={inputRef}
                    className="border-control-border text-ink focus:border-brand h-10 min-w-0 flex-1 rounded-[12px] border-[1.5px] px-3 text-base outline-none placeholder:text-disabled disabled:opacity-50"
                    placeholder={`Reply to ${replyTo.name}…`}
                    aria-label={`Reply to ${replyTo.name}`}
                    maxLength={COMMENT_MAX_LENGTH}
                    enterKeyHint="send"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") cancel();
                    }}
                    disabled={pending}
                  />
                  <button
                    type="submit"
                    disabled={pending || draft.trim().length === 0}
                    className="bg-brand text-primary-foreground h-10 shrink-0 rounded-[12px] px-3.5 text-sm font-semibold transition-transform active:scale-[.97] disabled:opacity-40"
                  >
                    Post
                  </button>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
