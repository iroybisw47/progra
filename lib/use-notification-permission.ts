"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  checkNotificationPermission,
  notificationPermissionSnapshot,
  subscribeNotificationPermission,
  type NotifyPermission,
} from "@/lib/notification-permission";

// The device's notification permission, live.
//
// useSyncExternalStore rather than useState + useEffect, for the two reasons
// spelled out in lib/use-muted.ts: the server can't know a native value, so
// rendering from it directly is a hydration mismatch; and the useState
// alternative trips react-hooks/set-state-in-effect, whose baseline is a gate.
//
// The server snapshot is `null` — "not looked yet" — which is also the first
// client render, so hydration matches. Every consumer treats `null` (and
// "unavailable") as "render no native UI", which is what keeps all of this
// invisible on progra.world without a separate isNativeApp store.
//
// The visibilitychange re-read is load-bearing, not a nicety: the only cure for
// a `denied` device is a trip to iOS Settings, and without re-reading on return
// the row the user just fixed would still say "Blocked". Same idiom as
// components/ensure-session-cap.tsx.
export function useNotificationPermission(): NotifyPermission | null {
  const state = useSyncExternalStore(
    subscribeNotificationPermission,
    notificationPermissionSnapshot,
    () => null
  );

  useEffect(() => {
    // Fire-and-forget: the store dispatches when the value lands, so there's no
    // setState in this effect.
    void checkNotificationPermission();

    const onVisibility = () => {
      if (!document.hidden) void checkNotificationPermission();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return state;
}
