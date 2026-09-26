import { notFound, redirect } from "next/navigation";

import { getProfile } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/require-user";
import { JOHN, REDESIGN } from "@/lib/flags";
import { isJohnUser } from "@/lib/john/cohort";
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
  // `intention` is appended only under the flag, so with John off this reader is
  // byte-identical to before — and it stays OUT of SESSION_COLUMNS, which the
  // cross-user feed shares.
  const { data } = await supabase
    .from("sessions")
    .select(`${SESSION_COLUMNS}, user_id${JOHN ? ", intention" : ""}`)
    .eq("id", sid)
    .maybeSingle();

  const row = data as
    | (SessionRow & { user_id: string; intention?: string | null })
    | null;
  // Own, ended session only — otherwise there's nothing to finish here.
  if (!row || row.user_id !== me.id) redirect("/");
  const session = rowToSession(row);
  if (session.endedAt == null) redirect("/clock/live");

  const [categories, goals, photoUrl, profile] = await Promise.all([
    listCategories(),
    listActiveGoals(),
    getSessionPhotoUrl(session),
    // cache()-wrapped and already awaited by the root layout this render, so
    // the cohort check costs nothing here.
    getProfile(),
  ]);
  const john = isJohnUser(profile);
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
      autoEnded={session.autoEndedAt !== null}
      john={john}
      // Echoed above the outcome field. Without it "what actually happened?" has
      // nothing to be measured against and decays into a second notes box.
      intention={john ? (row.intention ?? null) : null}
    />
  );
}
