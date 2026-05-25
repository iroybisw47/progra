"use client";

import { useEffect } from "react";

import { setProfileTimezone } from "@/app/actions/profile";

// Writes the browser's IANA timezone to the user's profile once per page load.
// Cheap and idempotent — Supabase will accept the same value harmlessly.
export function EnsureProfileSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    setProfileTimezone(tz).catch(() => {
      // Silent: not fatal, will retry on next page load.
    });
  }, []);

  return null;
}
