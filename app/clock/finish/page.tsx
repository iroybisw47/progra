import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { REDESIGN } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COLUMNS,
  rowToSession,
  type SessionRow,
} from "@/lib/db/sessions";
import { getSessionPhotoUrls } from "@/lib/db/session-photos";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { resolveAttribution } from "@/lib/session-attribution";
import { sessionWorkedMs } from "@/lib/session";

import { FinishClient } from "./finish-client";

// Finish & save (redesign): the confirmation + after-photo + privacy step shown
// right after a session ends (via Stop, or an Edit that set an end time). The
// session is already ended in the DB; this screen only decorates it (after
// photo, privacy) before dropping you back on Progress.
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

  const [categories, goals, photos] = await Promise.all([
    listCategories(),
    listActiveGoals(),
    getSessionPhotoUrls(session),
  ]);
  const attribution = resolveAttribution(session, categories, goals);
  const workedMs = sessionWorkedMs(session, session.endedAt);

  return (
    <FinishClient
      sessionId={session.id}
      label={session.taskName.trim() || "Untitled session"}
      description={session.description?.trim() || null}
      attribution={attribution}
      workedMs={workedMs}
      endedAt={session.endedAt}
      isPrivate={session.isPrivate}
      beforeUrl={photos.before}
      afterUrl={photos.after}
    />
  );
}
