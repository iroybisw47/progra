"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { completePlannedSession } from "@/app/actions/sessions";
import { plannedEndMs } from "@/lib/session";

// One attempt per session id per tab. Module-level so a client-side navigation
// (which remounts this leaf) can't re-fire it; cleared on failure so the next
// page load retries. Same shape as EnsureSessionCap's guard.
let attemptedFor: string | null = null;

// Ends a timed session once it has banked its target, back-dated to the instant
// the target was actually reached.
//
// Deliberately modelled on <EnsureSessionCap/>: there is no cron, so this is
// lazy, driven by one exact setTimeout plus a visibilitychange re-check for the
// backgrounded/suspended case. It writes nothing on any load where the target
// hasn't been reached, which is nearly all of them — and nothing ever for an
// open-ended session, which is every session started before this feature.
//
// It SKIPS /clock/live, where the timer runs its own "finishing in 5…"
// countdown with a Keep going escape. That's the one place someone is watching,
// and completing under them would remove the choice before they could take it.
// Everywhere else there's nobody to interrupt, so it ends immediately and the
// completion modal explains afterwards.
export function EnsurePlanComplete({
  sessionId,
  startedAt,
  pausedMs,
  pausedSince,
  plannedWorkMs,
}: {
  sessionId: string | null;
  startedAt: number | null;
  pausedMs: number | null;
  pausedSince: number | null;
  plannedWorkMs: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (sessionId == null || startedAt == null || plannedWorkMs == null) return;
    // The live timer owns this while you're looking at it.
    if (pathname.startsWith("/clock/live")) return;
    // Paused or on a break → worked time is frozen, so the target can't be
    // reached. Resuming revalidates the layout, which remounts this with fresh
    // timing and schedules then.
    if (pausedSince != null) return;

    let cancelled = false;

    const fire = () => {
      if (cancelled || attemptedFor === sessionId) return;
      attemptedFor = sessionId;
      completePlannedSession()
        .then((r) => {
          if (cancelled) return;
          if ("error" in r) {
            attemptedFor = null; // retry on the next load
            return;
          }
          // Either another tab won the race or the server disagreed — pull
          // fresh state rather than keep rendering a session that may be gone.
          router.refresh();
        })
        .catch(() => {
          // Offline or transient. Silent, like EnsureProfileSync — the next
          // load or visibility change tries again.
          attemptedFor = null;
        });
    };

    // Worked time, not wall clock: pauses and breaks push this instant later,
    // which is exactly what plannedEndMs encodes.
    const end = plannedEndMs(
      { startedAt, endedAt: null, pausedMs: pausedMs ?? 0, pausedSince: null },
      plannedWorkMs
    );

    // (a) Already past the target when the app opened — the closed-app case.
    if (end - Date.now() <= 0) {
      fire();
      return () => {
        cancelled = true;
      };
    }

    // (b) Crosses while the app is open. +1s so the server's own recomputation
    // is comfortably past the boundary. Capped at 10h, well under setTimeout's
    // ~24.8-day ceiling.
    const id = setTimeout(fire, end - Date.now() + 1000);
    const onVisibility = () => {
      if (!document.hidden && Date.now() >= end) fire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    sessionId,
    startedAt,
    pausedMs,
    pausedSince,
    plannedWorkMs,
    pathname,
    router,
  ]);

  return null;
}
