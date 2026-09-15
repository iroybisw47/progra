"use server";

import { after } from "next/server";

import { revalidateSocialSurfaces } from "@/lib/revalidate";
import { sendSocialPush } from "@/lib/push/send-social-push";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { validateCommentBody } from "@/lib/social/comments";
import { requireSeat } from "@/lib/auth/require-seat";
import { COMMENT_REPLIES } from "@/lib/flags";
import { isUuid } from "@/lib/validate";

type Result = { ok: true } | { error: string };

// Post a comment on a feed session. The DB is the real gate: RLS's insert policy
// only allows author_id = auth.uid() on a session the author can see (owner or a
// non-private session from an accepted friend), so a comment can never target a
// hidden session or be posted as someone else. The checks here are for a
// friendlier error and to avoid a wasted round-trip.
export async function addComment(
  sessionId: string,
  body: string
): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const valid = validateCommentBody(body, "Comment");
  if ("error" in valid) return valid;
  const trimmed = valid.body;
  if (!sessionId) return { error: "Couldn't post comment." };

  // `.select("id")` so the push dedupe can key on the comment — every comment
  // is news, unlike a re-toggled like. The author can select their own comment
  // on a visible session under the existing RLS.
  const { data: inserted, error } = await supabase
    .from("session_comments")
    .insert({
      session_id: sessionId,
      author_id: user.id,
      body: trimmed,
    })
    .select("id")
    .single();

  if (error) {
    // Kept generic: a policy denial here means the session isn't visible to the
    // author, and we don't confirm whether it exists / is private / is blocked.
    return { error: "Couldn't post comment." };
  }

  // Push AFTER the response — see toggleReaction for the shape and the
  // authorization argument. The insert succeeding is the proof.
  after(() =>
    sendSocialPush({
      kind: "comment",
      sessionId,
      actorId: user.id,
      commentId: (inserted as { id: string } | null)?.id ?? null,
      body: trimmed,
    })
  );

  revalidateSocialSurfaces();
  return { ok: true };
}

// Reply to a comment — a top-level one or another reply. The client names only
// the comment it's answering; the thread-guard trigger derives the thread root
// and who's being replied to from that row, and refuses (with RLS's own error)
// a target on another or invisible session, or one across a block with the
// replied-to person or the thread's author. RLS then applies exactly as for a
// comment. So, as with addComment, any failure is one generic message.
export async function addReply(
  sessionId: string,
  replyToId: string,
  body: string
): Promise<{ ok: true; commentId: string } | { error: string }> {
  if (!COMMENT_REPLIES) return { error: "Replies aren't available." };
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const valid = validateCommentBody(body, "Reply");
  if ("error" in valid) return valid;
  if (!isUuid(sessionId) || !isUuid(replyToId)) return { error: "Couldn't post reply." };

  const { data: inserted, error } = await supabase
    .from("session_comments")
    .insert({
      session_id: sessionId,
      author_id: user.id,
      body: valid.body,
      reply_to_id: replyToId,
    })
    .select("id")
    .single();
  const commentId = (inserted as { id: string } | null)?.id;
  if (error || !commentId) return { error: "Couldn't post reply." };

  // The recipient is read back from the stored row inside the sender, never
  // passed from here — see sendSocialPush's reply branch.
  after(() =>
    sendSocialPush({
      kind: "reply",
      sessionId,
      actorId: user.id,
      commentId,
      body: valid.body,
    })
  );

  revalidateSocialSurfaces();
  return { ok: true, commentId };
}

// Delete a comment. RLS's delete policy permits this only for the comment's
// author or the owner of the commented-on session, so authorization is enforced
// at the DB regardless of what id is passed. Deleting a top-level comment takes
// its replies with it (FK cascade); the UI confirms first when there are any.
export async function deleteComment(commentId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!commentId) return { error: "Couldn't delete comment." };

  const { error } = await supabase
    .from("session_comments")
    .delete()
    .eq("id", commentId);

  if (error) return { error: "Couldn't delete comment." };
  revalidateSocialSurfaces();
  return { ok: true };
}
