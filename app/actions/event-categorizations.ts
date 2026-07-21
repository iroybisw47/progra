"use server";

import { revalidateEventSurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

// Sets a manual category override for an event. Pass `null` to clear the
// override and revert to rule-based categorization.
export async function setEventCategory(
  eventId: string,
  categoryId: string | null
): Promise<Result> {
  const supabase = await createClient();

  if (categoryId === null) {
    const { error } = await supabase
      .from("event_categorizations")
      .delete()
      .eq("event_id", eventId);
    if (error) return { error: error.message };
  } else {
    // event_id is the PK so the default ON CONFLICT target works.
    const { error } = await supabase
      .from("event_categorizations")
      .upsert({
        event_id: eventId,
        category_id: categoryId,
        source: "manual",
      });
    if (error) return { error: error.message };
  }

  revalidateEventSurfaces();
  return { ok: true };
}
