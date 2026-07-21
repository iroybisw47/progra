"use client";

import { useEffect } from "react";

import { setProfileTimezone } from "@/app/actions/profile";

// Keeps the profile's timezone in sync with the browser. Only writes when they
// actually differ (travel, DST-zone moves) — the stored value is passed down
// from the layout, so normal page loads cost zero authed writes. A real change
// triggers the action's full revalidation (day boundaries shift everywhere).
export function EnsureProfileSync({
  timezone,
}: {
  timezone: string | null;
}) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || tz === timezone) return;
    setProfileTimezone(tz).catch(() => {
      // Silent: not fatal, will retry on next page load.
    });
  }, [timezone]);

  return null;
}
