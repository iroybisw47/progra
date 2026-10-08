"use client";

import { useEffect, useRef } from "react";

import { touchLastSeen } from "@/app/actions/profile";
import { linkDeviceEvents, syncDeviceState } from "@/app/actions/telemetry";
import { ANALYTICS } from "@/lib/flags";
import { habitReminderPref } from "@/lib/habit-reminder-prefs";
import { appPlugin } from "@/lib/native-plugins";
import { checkNotificationPermission } from "@/lib/notification-permission";
import { remindersEnabled } from "@/lib/reminder-prefs";
import {
  flush,
  getDeviceId,
  noteBackground,
  noteForeground,
  track,
} from "@/lib/telemetry/client";

// The one leaf that knows when the app is opened and put away. It records
// `app_opened` / `app_backgrounded`, flushes the event queue on the way out,
// claims this device's pre-sign-in events for the signed-in user, and keeps
// profiles.last_seen_at alive.
//
// Mounted UNGATED inside Shell, like NotificationLifecycle, for two reasons:
// the beta-full wall gets it (hitting the wall is exactly the drop-off worth
// measuring), and a leaf gated on `user` could never see sign-out.
//
// A client leaf rather than after() in the root layout, because after() only
// runs when the server renders the layout — resuming the iOS app from the
// background doesn't reload the page, so the most common way people open
// Progra would never register. On native the signal is the App plugin's
// `resume` / `pause` (didEnterBackground / willEnterForeground), which is what
// "backgrounded" means; `appStateChange` also fires for Control Center and the
// notification shade, so it is deliberately not used. On the web it is
// visibilitychange.
//
// LAST SEEN. With ANALYTICS off this calls touchLastSeen() exactly as the old
// LastSeenPing did, so the roster's "Opened" column never stops. With it on,
// the ingest RPC bumps last_seen_at from every app_opened event instead, and
// the device link runs on every open — it is one idempotent indexed UPDATE,
// and running it each time is what catches a batch that arrived while the
// cookie was expired.
export function AnalyticsLifecycle({
  userId,
  activeSessionId,
}: {
  userId: string | null;
  // The clock-reminder toggle is per session, so reporting it needs the id of
  // the session running right now. Read through a ref: a session starting or
  // ending must not re-attach the native listeners.
  activeSessionId: string | null;
}) {
  const sessionRef = useRef(activeSessionId);
  useEffect(() => {
    sessionRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    const onOpen = () => {
      const info = noteForeground();
      if (info) track("app_opened", { cold: info.cold, source: info.source });
      if (!userId) return;
      if (ANALYTICS) {
        const device = getDeviceId();
        if (device) void linkDeviceEvents(device);
        void syncDevice(sessionRef.current);
      } else {
        pingLastSeen();
      }
    };
    const onLeave = () => {
      track("app_backgrounded", { seconds_since_foreground: noteBackground() });
      flush({ background: true });
    };

    // The first run of this effect in a page life IS the open. The effect also
    // re-runs when the user changes (sign-in, sign-out): that is not an open,
    // but a fresh sign-in is the moment to claim the device's anonymous events.
    if (!openedThisPageLife) {
      openedThisPageLife = true;
      onOpen();
    } else if (userId && userId !== lastUserId) {
      if (ANALYTICS) {
        const device = getDeviceId();
        if (device) void linkDeviceEvents(device);
        void syncDevice(sessionRef.current);
      } else {
        pingLastSeen();
      }
    }
    lastUserId = userId;

    const app = appPlugin();
    if (app) {
      let cancelled = false;
      let handles: { remove: () => void }[] = [];
      void Promise.all([
        app.addListener("resume", onOpen),
        app.addListener("pause", onLeave),
      ])
        .then((hs) => {
          if (cancelled) hs.forEach((h) => h.remove());
          else handles = hs;
        })
        .catch(() => {
          // The plugin is unavailable; the open above still counted.
        });
      return () => {
        cancelled = true;
        handles.forEach((h) => h.remove());
      };
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") onOpen();
      else onLeave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId]);

  return null;
}

// Module scope, not state: these must survive the remounts a client-side
// navigation causes, or every navigation would read as a fresh open.
let openedThisPageLife = false;
let lastUserId: string | null = null;

// The device's notification permission plus the two on-device reminder
// toggles, mirrored to the profile so the dashboard can read them. Throttled
// here and again in the RPC (which also writes whenever something CHANGED, so
// a toggle flipped in Settings lands on the next open regardless).
const DEVICE_STATE_MIN_INTERVAL_MS = 10 * 60 * 1000;
let deviceStateSentAt = 0;
async function syncDevice(activeSessionId: string | null): Promise<void> {
  const now = Date.now();
  if (now - deviceStateSentAt < DEVICE_STATE_MIN_INTERVAL_MS) return;
  deviceStateSentAt = now;
  try {
    // A pure read; it never prompts.
    const permission = await checkNotificationPermission();
    const habit = habitReminderPref();
    await syncDeviceState(permission, {
      clock_reminders_off: !remindersEnabled(activeSessionId),
      habit_reminder_off: !habit.enabled,
      habit_reminder_time: habit.time,
    });
  } catch {
    // Telemetry never surfaces.
  }
}

// The flag-off fallback, throttled client-side exactly as LastSeenPing was so
// foreground/background churn never reaches the network; touch_last_seen
// throttles again in its WHERE.
const LAST_SEEN_MIN_INTERVAL_MS = 10 * 60 * 1000;
let lastSeenSentAt = 0;
function pingLastSeen() {
  const now = Date.now();
  if (now - lastSeenSentAt < LAST_SEEN_MIN_INTERVAL_MS) return;
  lastSeenSentAt = now;
  void touchLastSeen();
}
