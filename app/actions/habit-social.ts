"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { revalidateSocialSurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { LIKE_EMOJI } from "@/lib/social/reactions";

type ToggleResult = { ok: true; reacted: boolean } | { error: string };

// Toggle kudos on a habit check-off. Routed through the
// `toggle_habit_reaction` SECURITY DEFINER RPC (mirrors `toggle_recap_reaction`
// and `toggle_reaction`) so the insert-or-delete is atomic and the DB re-checks
// visibility and the emoji set — a reaction can't target a check-off you can't
// see, or be forged as another user.
export async function toggleHabitKudos(
  completionId: string
): Promise<ToggleResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!completionId) return { error: "Couldn't react." };

  const { data, error } = await supabase.rpc("toggle_habit_reaction", {
    p_completion_id: completionId,
    p_emoji: LIKE_EMOJI,
  });
  if (error) return { error: "Couldn't react." };

  revalidateSocialSurfaces();
  return { ok: true, reacted: data === true };
}
