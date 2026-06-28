"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

// Hides an event from Progra's /clock totals. The underlying Google event is
// untouched; un-hiding restores visibility.
export async function excludeEvent(eventId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("event_exclusions")
    .upsert({ event_id: eventId, user_id: user.id });
  if (error) return { error: error.message };

  revalidatePath("/clock");
  return { ok: true };
}

export async function restoreEvent(eventId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_exclusions")
    .delete()
    .eq("event_id", eventId);
  if (error) return { error: error.message };

  revalidatePath("/clock");
  return { ok: true };
}
