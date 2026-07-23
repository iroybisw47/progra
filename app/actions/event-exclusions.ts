"use server";

import { revalidateEventSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

// Hides an event from Progra's /clock totals. The underlying Google event is
// untouched; un-hiding restores visibility.
export async function excludeEvent(eventId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("event_exclusions")
    .upsert({ event_id: eventId, user_id: user.id });
  if (error) return { error: error.message };

  revalidateEventSurfaces();
  return { ok: true };
}

export async function restoreEvent(eventId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_exclusions")
    .delete()
    .eq("event_id", eventId);
  if (error) return { error: error.message };

  revalidateEventSurfaces();
  return { ok: true };
}
