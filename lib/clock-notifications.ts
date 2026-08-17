import { allReminderIds, type ClockReminder } from "@/lib/clock-reminders";
import { localNotificationsPlugin } from "@/lib/native-plugins";
import { checkNotificationPermission } from "@/lib/notification-permission";

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

// The plugin accessor lives in lib/native-plugins.ts now — see the long comment
// there for why a Capacitor plugin must never be imported in this app.
const plugin = localNotificationsPlugin;

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
    // A pure read — this must NEVER prompt. It sits after the cancel on
    // purpose: a user who has denied still needs stale reminders cleared, and
    // returning here leaves lastFingerprint untouched, so granting permission
    // mid-session re-syncs on the next call instead of being skipped as
    // "unchanged".
    if ((await checkNotificationPermission()) !== "granted") return;

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
