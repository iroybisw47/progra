import { localNotificationsPlugin } from "@/lib/native-plugins";
import { checkNotificationPermission } from "@/lib/notification-permission";

// The ONLY file that talks to @capacitor/local-notifications.
//
// Deliberately thin: a pure module decides which reminders exist and when
// (lib/clock-reminders.ts, lib/habit-reminders.ts — both tested), and this
// just hands that list to iOS. Keeping the plugin behind one module means the
// decision-making stays testable without mocking a native bridge.
//
// One ENGINE, one instance per reminder family (clock, habits), because the
// subtle invariants below are exactly what must not drift between two copies:
// cancel-then-schedule over the family's whole id range, the permission check
// AFTER the cancel, the fingerprint guard, errors swallowed. Each family's
// fixed id range is what makes wholesale cancel safe — nothing else can own
// its ids, and an empty list degenerates to "cancel everything" with no
// special case.
//
// EVERY sync is safe to call unconditionally — on the web, with the plugin
// missing, or with notification permission denied. A reminder is a nicety,
// and it may never break the feature it decorates.

export type LocalReminder = {
  id: number;
  // Wall-clock epoch ms.
  at: number;
  title: string;
  body: string;
};

export function createReminderSync(allIds: () => number[]): {
  sync: (reminders: LocalReminder[]) => Promise<void>;
  cancelAll: () => Promise<void>;
} {
  // Fingerprint of the last schedule actually written, so an identical request
  // is a no-op.
  //
  // LOAD-BEARING, not an optimisation. sync() cancels the family's whole id
  // range before scheduling — so if it's called repeatedly with the same input
  // (a layout re-render, a router.refresh, a poll), each run wipes the
  // previous run's notifications before they can fire. Nothing survives,
  // pending stays 0, and the failure is invisible.
  //
  // It covers title and body, not just id@at: today's habit reminder keeps its
  // id and 18:00 instant when one of three habits gets checked — only the name
  // list changes, and skipping that resync would fire a stale body.
  //
  // null, NOT "": an empty reminder list fingerprints to "", and notifications
  // deliberately outlive app launches — so the FIRST sync after a relaunch
  // must always cancel, or a schedule from a previous run (pref switched off,
  // session ended while the app was killed) survives untouched.
  let last: string | null = null;

  async function sync(reminders: LocalReminder[]): Promise<void> {
    const fingerprint = reminders
      .map((r) => `${r.id}@${r.at}@${r.title}@${r.body}`)
      .join("|");
    if (fingerprint === last) return;

    const ln = localNotificationsPlugin();
    if (!ln) return;

    try {
      // Unconditional: cancelling ids that aren't scheduled is a no-op.
      await ln.cancel({ notifications: allIds().map((id) => ({ id })) });

      if (reminders.length === 0) {
        // Cancelled above; record it so a later identical call skips even this.
        last = fingerprint;
        return;
      }
      // A pure read — this must NEVER prompt. It sits after the cancel on
      // purpose: a user who has denied still needs stale reminders cleared,
      // and returning here leaves the fingerprint untouched, so granting
      // permission mid-stream re-syncs on the next call instead of being
      // skipped as "unchanged".
      if ((await checkNotificationPermission()) !== "granted") return;

      await ln.schedule({
        notifications: reminders.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          // Discrete instants, never `repeats`/`every`. A repeating trigger
          // would keep firing forever for anyone who force-quits, since
          // cancelling requires the app to run.
          schedule: { at: new Date(r.at) },
        })),
      });
      // Only recorded once the write actually succeeded, so a throw leaves the
      // fingerprint stale and the next call retries rather than skipping.
      last = fingerprint;
    } catch {
      // Swallowed on purpose — a reminder may never break anything.
    }
  }

  // Clear everything this family owns, bypassing the fingerprint.
  async function cancelAll(): Promise<void> {
    const ln = localNotificationsPlugin();
    if (!ln) return;
    try {
      await ln.cancel({ notifications: allIds().map((id) => ({ id })) });
      last = null;
    } catch {
      // Swallowed on purpose.
    }
  }

  return { sync, cancelAll };
}
