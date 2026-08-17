"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  remindersEnabled,
  subscribeRemindersEnabled,
} from "@/lib/reminder-prefs";

// Whether reminders are on for this session, on this device.
//
// useSyncExternalStore for the reasons in lib/use-muted.ts: the server can't
// know a localStorage value, and the useState + useEffect alternative trips
// react-hooks/set-state-in-effect. The server snapshot is `true` — reminders
// default to on — which is also the first client render, so hydration matches.
//
// getSnapshot needs useCallback here, unlike use-muted.ts where nothing varies:
// it closes over sessionId, and a fresh function identity on every render would
// make useSyncExternalStore resubscribe in a loop.
export function useRemindersEnabled(sessionId: string | null): boolean {
  const getSnapshot = useCallback(
    () => remindersEnabled(sessionId),
    [sessionId]
  );
  return useSyncExternalStore(
    subscribeRemindersEnabled,
    getSnapshot,
    () => true
  );
}
