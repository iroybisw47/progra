// The notifications panel's comment and reply arms, reconciled. Pure, so the
// rules are testable without a database.
//
// Two arms can report the same row: "comments on my posts" and "replies to
// me". A reply on MY post to MY comment is in both — it shows once, as the
// reply ("X replied to you"). A reply on my post to someone else stays an
// ordinary "X commented". A reply from someone either of us has blocked shows
// nowhere — and in particular doesn't slip back in through the comment arm.

type Row = { id: string; author_id: string };

export function mergeReplyNotifications<C extends Row, R extends Row>(input: {
  me: string;
  commentRows: C[];
  replyRows: R[];
  // Reply authors with a block in either direction (are_blocked).
  blockedIds: ReadonlySet<string>;
}): { commentRows: C[]; replyRows: R[] } {
  const { me, commentRows, replyRows, blockedIds } = input;
  const replyIds = new Set(replyRows.map((r) => r.id));
  return {
    commentRows: commentRows.filter((c) => !replyIds.has(c.id)),
    replyRows: replyRows.filter((r) => r.author_id !== me && !blockedIds.has(r.author_id)),
  };
}
