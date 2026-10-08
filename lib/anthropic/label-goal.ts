import "server-only";

import { classifyGoalTitle } from "@/lib/anthropic/categorize-goal";
import { ANALYTICS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";

// Labels a goal after createGoal / updateGoal has returned — called inside
// after(), where a Server Function may still use cookies, so this runs under
// the CALLER'S OWN RLS client: it can only ever read and write their goals, and
// no service role is involved.
//
// PRIVATE GOALS ARE NEVER SENT. admin_list_users() already hides their titles
// even from the admin; a private goal's title leaving the database for a
// third party would be a bigger exposure than anything the dashboard shows.
// They surface as a "private" bucket instead.
//
// Writes only on a confident label: a failed call leaves category_label null,
// which is what the admin backfill looks for, so nothing is lost — it just
// waits. Flag-gated because the columns only exist once phase1.sql has run.
export async function labelGoalAfterWrite(goalId: string): Promise<void> {
  if (!ANALYTICS) return;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("goals")
      .select("id, title, is_private, status")
      .eq("id", goalId)
      .maybeSingle();
    const goal = data as
      | { id: string; title: string; is_private: boolean; status: string }
      | null;
    if (!goal || goal.is_private || goal.status !== "active") return;

    const label = await classifyGoalTitle(goal.title);
    if (!label) return;
    await supabase
      .from("goals")
      .update({ category_label: label, category_labeled_at: new Date().toISOString() })
      .eq("id", goalId);
  } catch {
    // Analytics may never break a goal save — and after() has already
    // returned the response anyway.
  }
}
