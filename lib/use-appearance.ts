"use client";

import { useSyncExternalStore } from "react";

import {
  appearancePref,
  currentTheme,
  setAppearancePref,
  subscribeAppearance,
  type AppearancePref,
  type Theme,
} from "@/lib/appearance";

// The device's appearance preference and the theme it resolves to, live.
//
// useSyncExternalStore for the reasons in lib/use-muted.ts. The snapshot is a
// string ("system:dark") so it's stable without a cache; the server snapshot
// is "system:light", which is also the first client render, so hydration
// matches and the real value swaps in immediately after.
function getSnapshot(): string {
  return `${appearancePref()}:${currentTheme()}`;
}

export function useAppearance(): {
  pref: AppearancePref;
  resolved: Theme;
  setPref: (pref: AppearancePref) => void;
} {
  const snap = useSyncExternalStore(
    subscribeAppearance,
    getSnapshot,
    () => "system:light"
  );
  const [pref, resolved] = snap.split(":") as [AppearancePref, Theme];
  return { pref, resolved, setPref: setAppearancePref };
}
