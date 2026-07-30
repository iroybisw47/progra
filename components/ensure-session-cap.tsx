"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { autoClockOut } from "@/app/actions/sessions";
import { sessionCapEndMs } from "@/lib/session";

// One attempt per session id per tab. Module-level so a client-side navigation
// (which remounts this leaf) can't re-fire it; cleared on failure so the next
// page load retries.
let attemptedFor: string | null = null;

// Enforces the write half of the 10-hour session cap. Mounted unconditionally
// for authed users in the root layout, following EnsureProfileSync: the stored
// value comes down from the server and the action fires ONLY when reality has
// diverged, so normal page loads cost zero authed writes. Failure is silent and
// retries on the next load.
//
// There is no cron in this app, so enforcement is lazy by design. No useNow /
// no 1s tick: an exact setTimeout crosses the cap live without a single extra
// render, and a visibilitychange re-check covers timers a backgrounded or
// suspended tab never fired.
export function EnsureSessionCap({
  sessionId,
  startedAt,
  pausedMs,
  pausedSince,
}: {
  sessionId: string | null;
  startedAt: number | null;
  pausedMs: number | null;
  pausedSince: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Paused → worked time is frozen, so the cap can't be reached while it
    // stays paused. Resuming revalidates the layout, which remounts this leaf
    // with fresh timing and schedules the timer then.
    if (sessionId == null || startedAt == null || pausedSince != null) return;

    let cancelled = false;

    const fire = () => {
      if (cancelled || attemptedFor === sessionId) return;
      attemptedFor = sessionId;
      autoClockOut()
        .then((r) => {
          if (cancelled) return;
          if ("error" in r) {
            attemptedFor = null; // retry on the next load
            return;
          }
          if (!r.ended) {
            // Another tab won the race, or the server disagreed. Pull fresh
            // state rather than keep rendering a session that may be gone.
            router.refresh();
            return;
          }
          toast("Clocked out at 10 hours", {
            description: "Saved privately — review it before posting.",
          });
          // Same destination Stop reaches. Only from the clock surfaces: never
          // yank someone off the feed mid-scroll.
          if (pathname.startsWith("/clock")) {
            router.replace(`/clock/finish?sid=${r.sessionId}`);
          }
        })
        .catch(() => {
          // Offline or transient. Silent, like EnsureProfileSync — the next
          // page load or visibility change tries again.
          attemptedFor = null;
        });
    };

    const capEnd = sessionCapEndMs({
      startedAt,
      endedAt: null,
      pausedMs: pausedMs ?? 0,
      pausedSince: null,
    });

    // (a) Already past the cap when the app opened.
    if (capEnd - Date.now() <= 0) {
      fire();
      return () => {
        cancelled = true;
      };
    }

    // (b) Crosses the cap while the app is open. +1s so the server's own
    // recomputation is comfortably past the boundary. 10h is well under
    // setTimeout's ~24.8-day ceiling.
    const id = setTimeout(fire, capEnd - Date.now() + 1000);
    // Backgrounded tabs throttle timers (and mobile Safari suspends them), so
    // re-check on refocus.
    const onVisibility = () => {
      if (!document.hidden && Date.now() >= capEnd) fire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionId, startedAt, pausedMs, pausedSince, pathname, router]);

  return null;
}
