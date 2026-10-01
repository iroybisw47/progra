import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { getProfile, isCalendarConnected } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { REDESIGN } from "@/lib/flags";

import { SettingsClient } from "./settings-client";

function countOpen(data: unknown): number {
  return Array.isArray(data)
    ? data.filter((r) => (r as { status?: string }).status === "open").length
    : 0;
}

// The Settings hub (V2). Consolidates account/identity/timezone/calendar, links
// to the user's data (goals/categories/habits/past sessions), sharing controls,
// the admin page (admin only), sign out, and account deletion. Flag-gated.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  if (!REDESIGN) notFound();
  const user = await requireUser();
  const params = await searchParams;
  const profile = await getProfile();

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  let openReports = 0;
  if (isAdmin === true) {
    // All three feed the one badge on the Admin row — the row is a link to
    // /admin, and /admin is where all three queues live. Bug reports and
    // suggestions are filtered to open ones because their RPCs return the
    // settled rows too, and a badge counting settled work would never clear.
    // Each count degrades to 0 on error (missing RPC = no badge, not a crash).
    const [reportsRes, bugsRes, suggestionsRes] = await Promise.all([
      supabase.rpc("admin_list_reports"),
      supabase.rpc("admin_list_bug_reports"),
      supabase.rpc("admin_list_suggestions"),
    ]);
    const reports = Array.isArray(reportsRes.data) ? reportsRes.data.length : 0;
    const bugs = countOpen(bugsRes.data);
    const suggestions = countOpen(suggestionsRes.data);
    openReports = reports + bugs + suggestions;
  }

  return (
    <SettingsClient
      email={user.email ?? ""}
      username={profile?.username ?? null}
      displayName={profile?.display_name ?? null}
      bio={profile?.bio ?? null}
      timezone={profile?.timezone ?? null}
      avatarPath={profile?.avatar_path ?? null}
      calendarConnected={isCalendarConnected(profile)}
      socialPushesEnabled={profile?.social_pushes_enabled ?? null}
      // NOT NULL with default true in the DB; `!== false` also covers a profile
      // read from before the column existed.
      nudgesEnabled={profile?.nudges_enabled !== false}
      calendarStatus={
        params.calendar === "connected" || params.calendar === "error"
          ? params.calendar
          : null
      }
      isAdmin={isAdmin === true}
      openReports={openReports}
    />
  );
}
