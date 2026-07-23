"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import {
  REPORT_NOTE_MAX,
  isReportReason,
  type ReportTargetType,
} from "@/lib/social/reports";

type Result = { ok: true } | { error: string };

const TARGET_TYPES: ReportTargetType[] = ["story", "comment", "profile"];

// File a report. Write-only for users: the reports table's RLS allows this
// insert (reporter = auth.uid()) but no select, so a reporter can never read
// reports — only the admin can, via the definer RPCs. Content is validated
// against the fixed reason set + a note cap.
export async function reportContent(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  note: string
): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  if (!TARGET_TYPES.includes(targetType) || !targetId) {
    return { error: "Couldn't submit report." };
  }
  if (!isReportReason(reason)) return { error: "Pick a reason." };
  const trimmedNote = note.trim().slice(0, REPORT_NOTE_MAX);

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    note: trimmedNote || null,
  });
  if (error) return { error: "Couldn't submit report." };

  return { ok: true };
}
