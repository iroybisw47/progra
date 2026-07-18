import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getSessionPhotoUrl } from "@/lib/db/session-photos";
import { SOCIAL_ENABLED } from "@/lib/flags";

import { AdminReports, type AdminReport } from "./admin-reports";

// Shape of each element returned by the admin_list_reports() RPC. The RPC is
// SECURITY DEFINER and reads the target preview across RLS, so it embeds the
// comment body / story photo paths that the admin couldn't otherwise read.
type RawReport = {
  id: string;
  reporter_username: string | null;
  target_type: "story" | "comment" | "profile";
  target_id: string;
  reason: string;
  note: string | null;
  created_at: string;
  target: {
    // story (a reported session; "story" is the persisted report_target_type)
    session_id?: string;
    label?: string;
    is_goal?: boolean;
    photo_path?: string | null;
    owner_username?: string | null;
    // comment
    body?: string | null;
    author_username?: string | null;
    // profile
    username?: string | null;
    display_name?: string | null;
    // set by the RPC when the target no longer exists / was taken down
    gone?: boolean;
  } | null;
};

// The private moderation queue. Flag-gated and 404s anyone who isn't the admin
// (is_admin() also re-checked inside every admin_* RPC). Reads open reports plus
// an embedded target preview; story photos are re-signed here for review, which
// the is_admin() branch of the storage policy permits.
export default async function AdminPage() {
  if (!SOCIAL_ENABLED) notFound();
  await requireUser();

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  const { data } = await supabase.rpc("admin_list_reports");
  const rows = (data ?? []) as RawReport[];

  const reports: AdminReport[] = await Promise.all(
    rows.map(async (row): Promise<AdminReport> => {
      const base = {
        id: row.id,
        reporterUsername: row.reporter_username,
        reason: row.reason,
        note: row.note,
        createdAt: row.created_at,
      };
      const t = row.target ?? {};

      if (row.target_type === "story") {
        // A taken-down session has its photo_path nulled by
        // admin_take_down_story, which is what `gone` reflects here.
        const gone = t.gone === true || !t.photo_path;
        const photoUrl = gone
          ? null
          : await getSessionPhotoUrl({ photoPath: t.photo_path ?? null });
        return {
          ...base,
          target: {
            kind: "story",
            sessionId: row.target_id,
            label: t.label ?? "Session",
            isGoal: t.is_goal === true,
            photoUrl,
            ownerUsername: t.owner_username ?? null,
            gone,
          },
        };
      }

      if (row.target_type === "comment") {
        return {
          ...base,
          target: {
            kind: "comment",
            commentId: row.target_id,
            body: t.body ?? null,
            authorUsername: t.author_username ?? null,
            gone: t.gone === true || t.body == null,
          },
        };
      }

      return {
        ...base,
        target: {
          kind: "profile",
          userId: row.target_id,
          username: t.username ?? null,
          displayName: t.display_name ?? null,
        },
      };
    })
  );

  return <AdminReports reports={reports} />;
}
