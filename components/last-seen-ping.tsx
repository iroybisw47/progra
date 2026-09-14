"use client";

import { useEffect } from "react";

import { touchLastSeen } from "@/app/actions/profile";

// Client-side throttle, on top of the one in the RPC. The RPC's alone would be
// correct, but this one means foreground/background churn never reaches the
// network at all. Module scope, so it survives remounts within one page life.
const MIN_INTERVAL_MS = 10 * 60 * 1000;
let lastSentAt = 0;

function ping() {
  const now = Date.now();
  if (now - lastSentAt < MIN_INTERVAL_MS) return;
  lastSentAt = now;
  // Fire-and-forget. Server actions are dispatched one at a time, so this can
  // delay a tap made in the same instant by one short round trip — acceptable
  // at once per ten minutes, and the reason for the throttle above.
  void touchLastSeen();
}

// Feeds profiles.last_seen_at — "last opened" on the admin analytics roster.
//
// A client leaf rather than after() in the root layout, because after() only
// runs when the server renders the layout. Resuming the iOS app from the
// background doesn't reload the page, so the most common way people open Progra
// would never register. visibilitychange catches it.
//
// Renders nothing.
export function LastSeenPing() {
  useEffect(() => {
    ping();
    function onVisibility() {
      if (document.visibilityState === "visible") ping();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return null;
}
