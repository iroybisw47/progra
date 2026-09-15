// Comment threads, one level deep (the Instagram model). Pure and client-safe:
// the session page groups with these on the server, the thread component
// collapses and deep-links with them on the client.
//
// The shape is decided in the database, not here: the thread-guard trigger
// sets parent_id to the thread's ROOT on every reply (a reply to a reply
// included) and reply_to_author_id to whoever was replied to. So grouping is a
// single pass over the oldest-first list — a root is always older than its
// replies, because a reply can only be posted to a comment that exists.

import { isUuid } from "@/lib/validate";

// What the helpers need to know about a comment. CommentItem satisfies it.
export type ThreadableComment = {
  id: string;
  parentId: string | null;
  replyToId: string | null;
  author: { userId: string };
  replyTo: { userId: string; username: string; displayName: string | null } | null;
};

export type CommentThread<T extends ThreadableComment> = { root: T; replies: T[] };

// Oldest-first in, oldest-first out, at both levels. A reply whose root isn't
// in the list (its author couldn't be hydrated, so the root was dropped)
// renders as a top-level comment rather than vanishing.
export function groupCommentThreads<T extends ThreadableComment>(
  items: T[]
): CommentThread<T>[] {
  const threads: CommentThread<T>[] = [];
  const byRoot = new Map<string, CommentThread<T>>();
  for (const item of items) {
    const root = item.parentId === null ? undefined : byRoot.get(item.parentId);
    if (root) {
      root.replies.push(item);
      continue;
    }
    const thread = { root: item, replies: [] };
    threads.push(thread);
    if (item.parentId === null) byRoot.set(item.id, thread);
  }
  return threads;
}

// Who a reply is visibly aimed at — shown as "@name" before its body. Only for
// a reply to a REPLY: a reply to the root is obviously to the root's author.
// Still shown after the replied-to comment is deleted (reply_to_id goes null,
// reply_to_author_id stays), and never for replying to yourself.
export function replyMention<T extends ThreadableComment>(
  c: T
): NonNullable<T["replyTo"]> | null {
  if (c.parentId === null || c.replyTo === null) return null;
  if (c.replyToId === c.parentId) return null;
  if (c.replyTo.userId === c.author.userId) return null;
  return c.replyTo as NonNullable<T["replyTo"]>;
}

// Replies shown before "View N more replies". A thread only collapses when it
// would hide at least two — collapsing to hide one reply saves nothing.
export const VISIBLE_REPLIES = 2;

export function splitReplies<T>(
  replies: T[],
  expanded: boolean
): { shown: T[]; hiddenCount: number } {
  if (expanded || replies.length <= VISIBLE_REPLIES + 1) {
    return { shown: replies, hiddenCount: 0 };
  }
  return {
    shown: replies.slice(0, VISIBLE_REPLIES),
    hiddenCount: replies.length - VISIBLE_REPLIES,
  };
}

// The DOM id a comment row carries, and the hash a push / panel row links to.
export function commentAnchorId(commentId: string): string {
  return `c-${commentId}`;
}

// "#c-<uuid>" → the comment id, or null for anything else.
export function parseCommentAnchor(hash: string): string | null {
  const match = /^#c-(.+)$/.exec(hash);
  return match && isUuid(match[1]) ? match[1] : null;
}

// The root id of the thread that holds this comment, or null.
export function threadOf<T extends ThreadableComment>(
  threads: CommentThread<T>[],
  commentId: string
): string | null {
  for (const t of threads) {
    if (t.root.id === commentId || t.replies.some((r) => r.id === commentId)) {
      return t.root.id;
    }
  }
  return null;
}
