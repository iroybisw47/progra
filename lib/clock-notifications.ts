import type { LocalNotificationsPlugin } from "@capacitor/local-notifications";

import { allReminderIds, type ClockReminder } from "@/lib/clock-reminders";

// The ONLY file that talks to @capacitor/local-notifications.
//
// Deliberately thin: pass 1 decided which reminders exist and when
// (lib/clock-reminders.ts, pure and tested), and this just hands that list to
// iOS. Keeping the plugin behind one module means the decision-making stays
// testable without mocking a native bridge.
//
// EVERY export is safe to call unconditionally — on the web, with the plugin
// missing, or with notification permission denied. Clocking in, pausing and
// clocking out must behave identically whether or not a reminder gets
// scheduled; a reminder is a nicety, and it may never break the clock.

// Read straight off the Capacitor global. DO NOT import this plugin.
//
// Both import forms fail on device: `await import(...)` never settles, and a
// static import stalled too — impossible for a synchronous body in an async
// wrapper, which is how we know the bundler is doing something unexplained.
// Root cause was never established. What IS proven, from the Safari inspector
// on the device, is that window.Capacitor.Plugins.LocalNotifications reports
// display=granted, accepts a schedule and delivers the banner. Capacitor
// registers plugins on that global at bridge startup, so there's no module
// resolution and no chunk fetch that can be left pending.
//
// SYNCHRONOUS on purpose: a promise-returning accessor is what let the stall
// hide as a pending await through three rounds of debugging. Off-native the
// global is absent and this returns null, so the website and SSR are
// unaffected.
function plugin(): LocalNotificationsPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (
    window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { LocalNotifications?: LocalNotificationsPlugin };
      };
    }
  ).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.LocalNotifications ?? null;
}

// Exported for the tap listener in components/sync-clock-reminders.tsx, which
// needs the same global read. Sharing it is what stops that file quietly
// reintroducing an import() of its own.
export { plugin as notificationsPlugin };

// Whether a reminder could actually be delivered right now.
//
// On iOS local and remote notifications share ONE UNUserNotificationCenter
// authorization, and components/push-registration.tsx already requests it for
// every signed-in user — so this is usually already granted and no second
// prompt appears.
//
// The case worth surfacing: someone who dismissed that push prompt cannot be
// re-asked. iOS prompts once, ever, so `denied` is terminal until they change
// it in Settings. Callers use this to explain rather than fail silently.
export async function canScheduleReminders(): Promise<boolean> {
  const ln = plugin();
  if (!ln) return false;
  try {
    const { display } = await ln.checkPermissions();
    if (display === "granted") return true;
    // 'denied' is terminal — asking again shows nothing and returns denied.
    if (display === "denied") return false;
    // 'prompt' means it hasn't been asked on this device yet. Harmless to ask;
    // it's the same authorization push already wanted.
    const asked = await ln.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
}

// Replace the scheduled set with exactly `reminders`.
//
// Always cancel-then-schedule over the WHOLE reserved id range rather than
// diffing. Pass 1's fixed ids are what make that safe: there's at most one
// active session per user, so nothing else can own these ids, and an empty
// list degenerates to "cancel everything" with no special case. That property
// is why the caller can be a single layout leaf instead of six wired-up call
// sites — every path that changes a session ends in revalidateSessionSurfaces,
// which re-renders the leaf, which calls this.

// Fingerprint of the last schedule actually written, so an identical request is
// a no-op.
//
// LOAD-BEARING, not an optimisation. syncClockReminders cancels our whole id
// range before scheduling — so if it's called repeatedly with the same input
// (a layout re-render, a router.refresh, a poll), each run wipes the previous
// run's notifications before they can fire. Nothing survives, pending stays 0,
// and the failure is invisible.
let lastFingerprint = "";

export async function syncClockReminders(
  reminders: ClockReminder[]
): Promise<void> {
  const fingerprint = reminders.map((r) => `${r.id}@${r.at}`).join("|");
  if (fingerprint === lastFingerprint) return;

  const ln = plugin();
  if (!ln) return;

  try {
    // Unconditional: cancelling ids that aren't scheduled is a no-op.
    await ln.cancel({ notifications: allReminderIds().map((id) => ({ id })) });

    if (reminders.length === 0) {
      // Cancelled above; record it so a later identical call skips even this.
      lastFingerprint = fingerprint;
      return;
    }
    if (!(await canScheduleReminders())) return;

    await ln.schedule({
      notifications: reminders.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        // Discrete instants, never `repeats`/`every`. A repeating trigger would
        // keep firing forever for anyone who force-quits mid-session, since
        // cancelling requires the app to run.
        schedule: { at: new Date(r.at) },
      })),
    });
    // Only recorded once the write actually succeeded, so a throw leaves the
    // fingerprint stale and the next call retries rather than skipping.
    lastFingerprint = fingerprint;
  } catch {
    // Swallowed on purpose — a reminder may never break the clock.
  }
}

// Clear everything this module owns. Used when a session ends by any route.
export async function cancelClockReminders(): Promise<void> {
  const ln = plugin();
  if (!ln) return;
  try {
    await ln.cancel({ notifications: allReminderIds().map((id) => ({ id })) });
  } catch {
    // Swallowed on purpose.
  }
}
