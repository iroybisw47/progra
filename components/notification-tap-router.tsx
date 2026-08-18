"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CLOCK_REMINDERS, HABIT_REMINDERS } from "@/lib/flags";
import { isHabitReminderId } from "@/lib/habit-reminders";
import { localNotificationsPlugin } from "@/lib/native-plugins";

// Where a tapped notification lands. ONE listener for every family, routing by
// the notification's reserved id — two leaves each attaching their own
// listener would both fire on every tap and race their pushes.
//
// Habit reminders open the dashboard, where the habit checklist lives. Clock
// reminders (and anything unrecognised — the tap must go SOMEWHERE) open the
// live timer; a tap can arrive after the session ended, and /clock/live
// already redirects to /clock when there's nothing running.
//
// Its own leaf rather than living inside a sync component, so it stays
// attached whichever flags are on — inside SyncClockReminders it died with
// CLOCK_REMINDERS off, taking habit-tap routing with it.
export function NotificationTapRouter() {
  const router = useRouter();

  useEffect(() => {
    if (!CLOCK_REMINDERS && !HABIT_REMINDERS) return;
    let handle: { remove: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        // Off the Capacitor global — see lib/native-plugins.ts for why neither
        // import form works on device. Null on web, nothing to attach.
        const ln = localNotificationsPlugin();
        if (!ln) return;
        const h = await ln.addListener(
          "localNotificationActionPerformed",
          (event) =>
            router.push(
              isHabitReminderId(event.notification?.id) ? "/" : "/clock/live"
            )
        );
        if (cancelled) h.remove();
        else handle = h;
      } catch {
        // Web, or the plugin is unavailable. Nothing to attach.
      }
    })();

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [router]);

  return null;
}
