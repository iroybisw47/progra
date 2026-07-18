import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { REDESIGN } from "@/lib/flags";
import { getActiveSession } from "@/lib/db/sessions";
import { listCategories } from "@/lib/db/categories";
import { listActiveGoals } from "@/lib/db/goals";
import { resolveAttribution } from "@/lib/session-attribution";

import { LiveTimerClient } from "./live-timer-client";

// The full-screen live timer (redesign). You land here after clocking in on
// /clock, and the nav center button reopens it while a session runs. With no
// active session there's nothing to show, so bounce back to /clock.
export default async function LiveTimerPage() {
  if (!REDESIGN) notFound();
  await requireUser();

  const active = await getActiveSession();
  if (!active) redirect("/clock");

  const [categories, goals] = await Promise.all([
    listCategories(),
    listActiveGoals(),
  ]);
  const attribution = resolveAttribution(active, categories, goals);

  return (
    <LiveTimerClient
      sessionId={active.id}
      label={active.taskName.trim() || "Untitled session"}
      description={active.description?.trim() || null}
      attribution={attribution}
      startedAt={active.startedAt}
      pausedMs={active.pausedMs}
      pausedSince={active.pausedSince}
      hasPhoto={active.photoPath != null}
    />
  );
}
