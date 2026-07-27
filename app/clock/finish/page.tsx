import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { REDESIGN } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import { getSessionPhotoUrl } from "@/lib/db/session-photos";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { resolveAttribution } from "@/lib/session-attribution";
import { sessionWorkedMs } from "@/lib/session";

import { FinishClient } from "./finish-client";

// Finish & post (redesign): the compose step shown right after a session ends
// (via Stop, or an Edit that set an end time). The session arrives ended AND
// draft-private (clockOut/editActiveSessionTime set is_private with draft:
// true), so friends can't see it — or its photo — until Post applies the chosen
// visibility here. You can still edit notes, add a photo, or delete an
// accidental clock-in. Abandoning the screen leaves the session saved but
// private.
export default async function FinishPage({
  searchParams,
}: {
  searchParams: Promise<{ sid?: string }>;
}) {
  if (!REDESIGN) notFound();
  const me = await requireUser();
  const { sid } = await searchParams;
  if (!sid) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(`${SESSION_COLUMNS}, user_id`)
    .eq("id", sid)
    .maybeSingle();

  const row = data as (SessionRow & { user_id: string }) | null;
  // Own, ended session only — otherwise there's nothing to finish here.
  if (!row || row.user_id !== me.id) redirect("/");
  const session = rowToSession(row);
  if (session.endedAt == null) redirect("/clock/live");

  const [categories, goals, photoUrl] = await Promise.all([
    listCategories(),
    listActiveGoals(),
    getSessionPhotoUrl(session),
  ]);
  const attribution = resolveAttribution(session, categories, goals);
  const workedMs = sessionWorkedMs(session, session.endedAt);

  return (
    <FinishClient
      sessionId={session.id}
      label={session.taskName.trim() || "Untitled session"}
      initialNotes={session.description ?? ""}
      attribution={attribution}
      workedMs={workedMs}
      photoUrl={photoUrl}
    />
  );
}
