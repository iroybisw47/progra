"use server";

import { revalidateGoalSurfaces } from "@/lib/revalidate";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { capText } from "@/lib/validate";
import { isPaletteFill } from "@/lib/palette";
import { requireSeat } from "@/lib/auth/require-seat";
import { JOHN } from "@/lib/flags";
import { isJohnRequest } from "@/lib/john/gate";
import { TARGET_OUTCOME_MAX } from "@/lib/john/instrumentation";

type Result = { ok: true } | { error: string };

// Server-side field caps (clients also cap; never trust the client).
const TITLE_MAX = 120;
const DESC_MAX = 500;

// A deadline is a DAY in the user's own calendar, stored as a Postgres `date` —
// the same shape and the same reason as habit_completions.completed_on. Matches
// what <input type="date"> submits.
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Build the John half of a goal write, or an error string. Returns an EMPTY
// object when the caller sent neither field, so the cohort round-trip is skipped
// for the ~50 users whose UI cannot produce them.
//
// No "must be in the future" check, deliberately: a deadline that has passed is
// a real state, and it is exactly the state worth measuring.
async function johnGoalFields(input: {
  deadlineOn?: string | null;
  targetOutcome?: string | null;
}): Promise<Record<string, unknown> | { error: string }> {
  if (input.deadlineOn === undefined && input.targetOutcome === undefined) {
    return {};
  }
  if (!JOHN || !(await isJohnRequest())) return { error: "Not available" };

  const out: Record<string, unknown> = {};
  if (input.deadlineOn !== undefined) {
    if (input.deadlineOn !== null && !LOCAL_DATE_RE.test(input.deadlineOn)) {
      return { error: "Invalid date" };
    }
    out.deadline_on = input.deadlineOn;
  }
  if (input.targetOutcome !== undefined) {
    out.target_outcome = capText(input.targetOutcome, TARGET_OUTCOME_MAX);
  }
  return out;
}

type CreateGoalInput = {
  title: string;
  description?: string;
  weeklyQuotaHours: number;
  // Must be one of the nine palette hues; anything else is rejected rather
  // than stored, same rule categories and habits follow.
  color?: string | null;
  // John (two-user test), both optional.
  deadlineOn?: string | null;
  targetOutcome?: string | null;
};

// Success carries the new id, so a caller that may save again (onboarding's
// Back → Save goal) can update instead of creating a duplicate.
export async function createGoal(
  input: CreateGoalInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const title = capText(input.title, TITLE_MAX);
  if (!title) return { error: "Title required" };
  if (!Number.isFinite(input.weeklyQuotaHours) || input.weeklyQuotaHours <= 0) {
    return { error: "Weekly quota must be a positive number" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  // null clears the color (back to the id-derived fallback); an unrecognised
  // value is rejected outright so freehand hexes can't drift in.
  if (input.color != null && !isPaletteFill(input.color)) {
    return { error: "Unknown color" };
  }

  const john = await johnGoalFields(input);
  if ("error" in john) return john as { error: string };

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title,
      description: capText(input.description, DESC_MAX),
      weekly_quota_hours: input.weeklyQuotaHours,
      color: input.color ?? null,
      ...john,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateGoalSurfaces();
  return { ok: true, id: (data as { id: string }).id };
}

type UpdateGoalPatch = {
  title?: string;
  description?: string | null;
  weeklyQuotaHours?: number;
  color?: string | null;
  // Social v2: true = owner-only, false = visible to accepted friends (Aspect 4).
  isPrivate?: boolean;
  // John (two-user test), both optional.
  deadlineOn?: string | null;
  targetOutcome?: string | null;
};

export async function updateGoal(
  id: string,
  patch: UpdateGoalPatch
): Promise<Result> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = capText(patch.title, TITLE_MAX);
    if (!t) return { error: "Title required" };
    update.title = t;
  }
  if (patch.description !== undefined) {
    update.description = capText(patch.description, DESC_MAX);
  }
  if (patch.weeklyQuotaHours !== undefined) {
    if (
      !Number.isFinite(patch.weeklyQuotaHours) ||
      patch.weeklyQuotaHours <= 0
    ) {
      return { error: "Weekly quota must be a positive number" };
    }
    update.weekly_quota_hours = patch.weeklyQuotaHours;
  }
  if (patch.color !== undefined) {
    if (patch.color != null && !isPaletteFill(patch.color)) {
      return { error: "Unknown color" };
    }
    update.color = patch.color;
  }
  if (patch.isPrivate !== undefined) {
    update.is_private = patch.isPrivate;
  }
  const john = await johnGoalFields(patch);
  if ("error" in john) return john as { error: string };
  Object.assign(update, john);

  const supabase = await createClient();
  const { error } = await supabase.from("goals").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidateGoalSurfaces();
  return { ok: true };
}

export async function archiveGoal(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateGoalSurfaces();
  return { ok: true };
}
