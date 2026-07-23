"use server";

import { revalidateSocialSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { COMMENT_MAX_LENGTH } from "@/lib/social/comments";

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

  const trimmed = body.trim();
  if (!trimmed) return { error: "Comment can't be empty." };
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return { error: `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.` };
  }
  if (!sessionId) return { error: "Couldn't post comment." };

  const { error } = await supabase.from("session_comments").insert({
    session_id: sessionId,
    author_id: user.id,
    body: trimmed,
  });

  if (error) {
    // Kept generic: a policy denial here means the session isn't visible to the
    // author, and we don't confirm whether it exists / is private / is blocked.
    return { error: "Couldn't post comment." };
  }
  revalidateSocialSurfaces();
  return { ok: true };
}

// Delete a comment. RLS's delete policy permits this only for the comment's
// author or the owner of the commented-on session, so authorization is enforced
// at the DB regardless of what id is passed.
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
