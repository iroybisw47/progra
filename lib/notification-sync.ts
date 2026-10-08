import { track } from "@/lib/analytics";
import { localNotificationsPlugin } from "@/lib/native-plugins";
import { checkNotificationPermission } from "@/lib/notification-permission";
import {
  diffReminderSchedule,
  localNotificationKey,
  reminderTypeForId,
} from "@/lib/telemetry/reminder-diff";

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
//
// LOGGING. A device can only ever say "I scheduled this" or "I cancelled it
// before it fired", so that is exactly what is reported: before the cancel,
// the engine asks iOS what this family still has pending (by the key it put
// in `extra`), diffs that against the new list, and emits
// notification_cancelled for what disappears and notification_scheduled for
// what is new — AFTER the respective plugin call succeeded. A reminder that
// already fired is simply absent from pending, so it is never "cancelled";
// the server derives "presumed fired" from that. The diff is pure and tested
// (lib/telemetry/reminder-diff.ts).

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
      const ids = allIds();
      const previousKeys = await pendingKeys(ln, ids);
      const next = reminders.map((r) => ({ id: r.id, at: Math.round(r.at) }));
      const diff = diffReminderSchedule(previousKeys, next);

      // Unconditional: cancelling ids that aren't scheduled is a no-op.
      await ln.cancel({ notifications: ids.map((id) => ({ id })) });
      for (const key of diff.cancelled) track("notification_cancelled", { key });

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
          // Rides inside the notification: getPending() hands it back for the
          // diff above, and the tap router reports it on a tap.
          extra: {
            key: localNotificationKey(r.id, r.at),
            ntype: reminderTypeForId(r.id),
          },
        })),
      });
      for (const s of diff.scheduled) {
        track("notification_scheduled", {
          key: localNotificationKey(s.id, s.at),
          type: reminderTypeForId(s.id),
          scheduled_for: s.at,
        });
      }
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
      const ids = allIds();
      const previousKeys = await pendingKeys(ln, ids);
      await ln.cancel({ notifications: ids.map((id) => ({ id })) });
      // Usually sign-out: the batch may then carry no user and be dropped by
      // the ingest, in which case these rows read as "presumed fired" later.
      // Accepted — it is one edge of one family, and the alternative is to
      // flush before the session cookie goes.
      for (const key of previousKeys) track("notification_cancelled", { key });
      last = null;
    } catch {
      // Swallowed on purpose.
    }
  }

  return { sync, cancelAll };
}

// The keys this family still has pending on the device. Empty on any failure:
// a diff against nothing reports everything new as scheduled and nothing as
// cancelled, which over-counts schedules once rather than inventing cancels.
async function pendingKeys(
  ln: NonNullable<ReturnType<typeof localNotificationsPlugin>>,
  ids: number[]
): Promise<string[]> {
  try {
    const idSet = new Set(ids);
    const { notifications } = await ln.getPending();
    return notifications
      .filter((n) => idSet.has(n.id))
      .map((n) => (n.extra as { key?: unknown } | undefined)?.key)
      .filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}
