"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { listCategories } from "@/lib/db/categories";
import { revalidateEventSurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

// Sets a manual category override for an event. Pass `null` to clear the
// override and revert to rule-based categorization. RLS scopes the
// event_categorizations write to the caller's own rows; the checks here are
// defense-in-depth — an auth guard (this was the one mutation missing it) and
// verifying the caller actually owns the category they're assigning.
export async function setEventCategory(
  eventId: string,
  categoryId: string | null
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  if (categoryId !== null) {
    const categories = await listCategories();
    if (!categories.some((c) => c.id === categoryId)) {
      return { error: "Unknown category." };
    }
  }

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
