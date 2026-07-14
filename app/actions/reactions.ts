"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isReactionEmoji } from "@/lib/social/reactions";

type Result = { ok: true; reacted: boolean } | { error: string };

// Toggle one emoji reaction on a feed session. Routed through the
// `toggle_reaction` SECURITY DEFINER RPC so the insert-or-delete is atomic and
// the DB re-checks visibility (can_see_session) + the allowed emoji set — a
// reaction can't target a session you can't see, and can't be forged as another
// user. Returns whether the reaction is now on or off.
export async function toggleReaction(
  sessionId: string,
  emoji: string
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!sessionId || !isReactionEmoji(emoji)) {
    return { error: "Couldn't react." };
  }

  const { data, error } = await supabase.rpc("toggle_reaction", {
    p_session_id: sessionId,
    p_emoji: emoji,
  });
  if (error) {
    // Kept generic: a denial means the session isn't visible to the user.
    return { error: "Couldn't react." };
  }

  revalidatePath("/");
  return { ok: true, reacted: data === true };
}
