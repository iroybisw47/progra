"use server";

import { revalidateSocialSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { LIKE_EMOJI } from "@/lib/social/reactions";
import { COMMENT_MAX_LENGTH } from "@/lib/social/comments";
import { requireSeat } from "@/lib/auth/require-seat";

type Result = { ok: true } | { error: string };
type ToggleResult = { ok: true; reacted: boolean } | { error: string };

// Toggle kudos on a recap post. Routed through the `toggle_recap_reaction`
// SECURITY DEFINER RPC (mirrors `toggle_reaction`) so the insert-or-delete is
// atomic and the DB re-checks visibility via can_see_recap + the emoji set — a
// reaction can't target a recap you can't see or be forged as another user.
export async function toggleRecapKudos(recapId: string): Promise<ToggleResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;
  if (!recapId) return { error: "Couldn't react." };

  const { data, error } = await supabase.rpc("toggle_recap_reaction", {
    p_recap_id: recapId,
    p_emoji: LIKE_EMOJI,
  });
  if (error) return { error: "Couldn't react." };

  revalidateSocialSurfaces();
  return { ok: true, reacted: data === true };
}

// Comment on a recap post. RLS's insert policy only allows author_id = auth.uid()
// on a recap the author can see (can_see_recap), so a comment can't target a
// hidden recap or be posted as someone else. The checks here are for a friendlier
// error and to skip a wasted round-trip.
export async function addRecapComment(
  recapId: string,
  body: string
): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const trimmed = body.trim();
  if (!trimmed) return { error: "Comment can't be empty." };
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return { error: `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.` };
  }
  if (!recapId) return { error: "Couldn't post comment." };

  const { error } = await supabase.from("recap_comments").insert({
    recap_post_id: recapId,
    author_id: user.id,
    body: trimmed,
  });
  if (error) return { error: "Couldn't post comment." };

  revalidateSocialSurfaces();
  return { ok: true };
}

// Delete a recap comment. RLS permits this only for the comment's author or the
// recap post's owner, so authorization is enforced at the DB regardless of id.
export async function deleteRecapComment(commentId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!commentId) return { error: "Couldn't delete comment." };

  const { error } = await supabase
    .from("recap_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { error: "Couldn't delete comment." };

  revalidateSocialSurfaces();
  return { ok: true };
}
