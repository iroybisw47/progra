"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { createClient } from "@/lib/supabase/server";
import {
  BUG_DESCRIPTION_MAX,
  BUG_ROUTE_MAX,
  BUG_USER_AGENT_MAX,
  BUG_VIEWPORT_MAX,
  isBugPlatform,
} from "@/lib/bug-reports";

type Result = { ok: true } | { error: string };

export type BugReportInput = {
  description: string;
  // Diagnostic context, gathered by the sheet. All optional — a report with
  // only a description is still worth having.
  route?: string | null;
  platform?: string | null;
  userAgent?: string | null;
  viewport?: string | null;
};

// File a bug report. Write-only for users, exactly like reportContent: the
// table's RLS allows this insert (reporter_id = auth.uid()) but no select, so a
// reporter can never read the queue — only the admin can, through the definer
// RPC. No revalidation: nothing on any surface shows these.
export async function submitBugReport(input: BugReportInput): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  // Truncate rather than reject, matching reportContent's treatment of `note`.
  // Losing the tail of an over-long report is better than losing the report.
  const description = input.description.trim().slice(0, BUG_DESCRIPTION_MAX);
  if (!description) return { error: "Tell us what went wrong." };

  // The context fields are diagnostic, not authorization — they don't need to
  // be trustworthy, only bounded, so a hostile client can't post a megabyte of
  // user-agent. An unrecognised platform is dropped, since the column has a
  // CHECK constraint that would reject the whole insert.
  const platform =
    input.platform && isBugPlatform(input.platform) ? input.platform : null;

  const { error } = await supabase.from("bug_reports").insert({
    reporter_id: user.id,
    description,
    route: cap(input.route, BUG_ROUTE_MAX),
    platform,
    user_agent: cap(input.userAgent, BUG_USER_AGENT_MAX),
    viewport: cap(input.viewport, BUG_VIEWPORT_MAX),
    // Stamped server-side so it can't be spoofed and needs no version constant
    // to hand-bump. Undefined outside Vercel (i.e. local dev) → null.
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
  if (error) return { error: "Couldn't send your report." };

  return { ok: true };
}

function cap(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim().slice(0, max);
  return trimmed || null;
}
