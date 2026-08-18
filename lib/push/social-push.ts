import { LIKE_EMOJI } from "@/lib/social/reactions";

// WHAT a social push says and where a tap on it lands — pure, so the copy is
// testable without touching APNs. The orchestrator (lib/push/send-social-push.ts)
// consumes this; lib/push/apns.ts does the sending.

export type SocialPushInput = {
  kind: "like" | "comment";
  // display_name ?? username ?? fallback — resolved by the caller.
  actorName: string;
  // The palette emoji the reaction stored. Only read for kind "like".
  emoji?: string;
  sessionId: string;
  taskName: string;
  // Only read for kind "comment".
  commentBody?: string;
};

export type SocialPushContent = {
  title: string;
  body: string;
  // In-app path a tap navigates to (rides in the push payload).
  url: string;
};

// A push body has roughly one line; a long comment gets its head, not a wall.
const COMMENT_SNIPPET_MAX = 100;

export function commentSnippet(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= COMMENT_SNIPPET_MAX) return trimmed;
  return `${trimmed.slice(0, COMMENT_SNIPPET_MAX - 1).trimEnd()}…`;
}

export function composeSocialPush(input: SocialPushInput): SocialPushContent {
  const url = `/session/${input.sessionId}`;

  if (input.kind === "comment") {
    return {
      title: input.actorName,
      body: `commented on "${input.taskName}": ${commentSnippet(input.commentBody ?? "")}`,
      url,
    };
  }

  // The feed's heart stores LIKE_EMOJI under the hood, so 👍 reads as "liked";
  // the other palette emoji name themselves.
  const body =
    input.emoji === undefined || input.emoji === LIKE_EMOJI
      ? `liked your session "${input.taskName}"`
      : `reacted ${input.emoji} to your session "${input.taskName}"`;
  return { title: input.actorName, body, url };
}

// The push_log primary key — what "already sent" means, per kind.
//
// Likes dedupe per (actor, session): toggling the heart off and on must not
// re-ping the owner, and the reaction row itself is gone after a toggle-off so
// the log is the only memory. Comments dedupe per COMMENT — a genuine second
// comment is new information and must push; spam is bounded by the friction of
// writing one and by friendship itself.
export function likeDedupeKey(actorId: string, sessionId: string): string {
  return `like:${actorId}:${sessionId}`;
}

export function commentDedupeKey(commentId: string): string {
  return `comment:${commentId}`;
}
