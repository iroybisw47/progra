"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { createClient } from "@/lib/supabase/server";
import { SUGGESTION_BODY_MAX } from "@/lib/suggestions";

type Result = { ok: true } | { error: string };

// File a suggestion. Write-only for users, exactly like submitBugReport and
// reportContent: the table's RLS allows this insert (suggester_id = auth.uid())
// but no select, so a user can never read the suggestion box — only the admin
// can, through the definer RPC. No revalidation: nothing on any user-facing
// surface shows these, so there is no cache to bust.
export async function submitSuggestion(body: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  // Truncate rather than reject, matching submitBugReport's treatment of
  // `description`. Losing the tail of a long suggestion beats losing the idea.
  const text = body.trim().slice(0, SUGGESTION_BODY_MAX);
  if (!text) return { error: "Tell us your idea first." };

  const { error } = await supabase.from("suggestions").insert({
    suggester_id: user.id,
    body: text,
  });
  if (error) return { error: "Couldn't send your suggestion." };

  return { ok: true };
}
