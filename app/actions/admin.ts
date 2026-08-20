"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isBugStatus } from "@/lib/bug-reports";

type Result = { ok: true } | { error: string };
type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Thin wrappers over the admin RPCs. Each RPC re-checks is_admin() internally
// and raises for anyone else; the requireAdmin() gate below is defense-in-depth
// so a mistake in a single RPC's internal check can't become a moderation-
// privilege bypass. The /admin page also 404s non-admins. Errors are generic.
async function requireAdmin(
  supabase: ServerClient
): Promise<{ ok: true } | { error: string }> {
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) return { error: "Not authorized." };
  return { ok: true };
}

export async function resolveReport(
  reportId: string,
  status: "actioned" | "dismissed"
): Promise<Result> {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if ("error" in gate) return gate;
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
  const gate = await requireAdmin(supabase);
  if ("error" in gate) return gate;
  const { error } = await supabase.rpc("admin_take_down_story", {
    p_session_id: sessionId,
  });
  if (error) return { error: "Couldn't take down the story." };
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteReportedComment(commentId: string): Promise<Result> {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if ("error" in gate) return gate;
  const { error } = await supabase.rpc("admin_delete_comment", {
    p_comment_id: commentId,
  });
  if (error) return { error: "Couldn't delete the comment." };
  revalidatePath("/admin");
  return { ok: true };
}

export async function takeDownRecap(recapId: string): Promise<Result> {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if ("error" in gate) return gate;
  const { error } = await supabase.rpc("admin_take_down_recap", {
    p_recap_id: recapId,
  });
  if (error) return { error: "Couldn't take down the recap." };
  revalidatePath("/admin");
  return { ok: true };
}

// ── Beta capacity ──────────────────────────────────────────────────────────
// The 250-seat cap's admin controls. admin_grant_seat refuses when the beta is
// full rather than growing it silently, so admitting past the ceiling is two
// deliberate steps: raise the cap, then grant.

export async function grantBetaSeat(
  userId: string
): Promise<{ ok: true; seat: number } | { error: string }> {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if ("error" in gate) return gate;
  const { data, error } = await supabase.rpc("admin_grant_seat", {
    p_user: userId,
  });
  // The RPC raises when there's no room; don't leak the exception text.
  if (error) return { error: "Beta is full — raise the cap first." };
  revalidatePath("/admin");
  return { ok: true, seat: data as number };
}

export async function setBetaSeatCap(cap: number): Promise<Result> {
  if (!Number.isInteger(cap) || cap < 0) return { error: "Invalid cap." };
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if ("error" in gate) return gate;
  const { error } = await supabase.rpc("admin_set_seat_cap", { p_cap: cap });
  if (error) return { error: "Couldn't update the cap." };
  revalidatePath("/admin");
  return { ok: true };
}

// ── Bug reports ────────────────────────────────────────────────────────────
// Triage, not moderation: `open` is the inbox, and reopening is allowed because
// "fixed" turns out to be wrong often enough to need an undo.

export async function resolveBugReport(
  id: string,
  status: string
): Promise<Result> {
  if (!isBugStatus(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if ("error" in gate) return gate;
  const { error } = await supabase.rpc("admin_resolve_bug_report", {
    p_id: id,
    p_status: status,
  });
  if (error) return { error: "Couldn't update the report." };
  revalidatePath("/admin");
  return { ok: true };
}
