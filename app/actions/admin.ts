"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

// Thin wrappers over the admin RPCs. Each RPC re-checks is_admin() internally
// and raises for anyone else, so these are safe even without an app-layer gate
// (the /admin page also 404s non-admins). Errors are kept generic.

export async function resolveReport(
  reportId: string,
  status: "actioned" | "dismissed"
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_report", {
    p_id: reportId,
    p_status: status,
  });
  if (error) return { error: "Couldn't update report." };
  revalidatePath("/admin");
  return { ok: true };
}

export async function takeDownStory(sessionId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_take_down_story", {
    p_session_id: sessionId,
  });
  if (error) return { error: "Couldn't take down the story." };
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteReportedComment(commentId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_comment", {
    p_comment_id: commentId,
  });
  if (error) return { error: "Couldn't delete the comment." };
  revalidatePath("/admin");
  return { ok: true };
}
