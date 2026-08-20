"use server";

import { after } from "next/server";

import { revalidateSocialSurfaces } from "@/lib/revalidate";
import { sendSocialPush } from "@/lib/push/send-social-push";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { isReactionEmoji } from "@/lib/social/reactions";
import { requireSeat } from "@/lib/auth/require-seat";

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
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;
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

  // Push AFTER the response (next/server after → Vercel waitUntil): the owner
  // hears about it, but the toggle can neither slow down nor fail because of
  // it. Only on reacted === true — un-reactions are nobody's news. The RPC
  // succeeding is the authorization proof sendSocialPush's admin reads rest on.
  if (data === true) {
    after(() =>
      sendSocialPush({
        kind: "like",
        sessionId,
        actorId: user.id,
        emoji,
      })
    );
  }

  revalidateSocialSurfaces();
  return { ok: true, reacted: data === true };
}
