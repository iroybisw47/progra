"use client";

import { useEffect } from "react";

import { applyAppearance, subscribeAppearance } from "@/lib/appearance";

// Keeps the theme on <html> in step with the device after the head script's
// first pass: the phone flipping light/dark while the preference is "system",
// another tab changing it, and — once, on mount — the theme-color metas and
// the iOS status bar, which the head script can't reach (the metas may not be
// parsed yet; the Capacitor bridge certainly isn't). Renders nothing.
export function SyncAppearance() {
  useEffect(() => {
    applyAppearance();
    return subscribeAppearance(applyAppearance);
  }, []);
  return null;
}
