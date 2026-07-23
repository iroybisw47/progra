import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { getProfile, isCalendarConnected } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { REDESIGN } from "@/lib/flags";

import { SettingsClient } from "./settings-client";

// The Settings hub (V2). Consolidates account/identity/timezone/calendar, links
// to the user's data (goals/categories/habits/past sessions), sharing controls,
// the moderator queue (admins only), sign out, and account deletion. Flag-gated.
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
    const { data } = await supabase.rpc("admin_list_reports");
    openReports = Array.isArray(data) ? data.length : 0;
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
