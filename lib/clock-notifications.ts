import { LocalNotifications } from "@capacitor/local-notifications";

import { allReminderIds, type ClockReminder } from "@/lib/clock-reminders";
import { isNativeApp } from "@/lib/native";

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

// STATICALLY imported, deliberately. This was a dynamic import() to keep the
// native plugin out of the web bundle — and on device that import never
// settled, so syncClockReminders parked forever before it could schedule
// anything. Proven from the Safari inspector: Capacitor.Plugins
// .LocalNotifications schedules and delivers perfectly, while the bundled
// import() of the same module hangs. Root cause of the stall is still unknown;
// what's known is that nothing here needs a chunk to arrive over the network.
//
// Safe eagerly: the package's entry only calls registerPlugin(), with no
// window/document at module scope, and its WEB implementation stays behind its
// own import() — so the SSR path and the web bundle both stay clean anyway.
//
// Still async, and still returns null off-native, so every call site is
// unchanged.
async function plugin() {
  if (!isNativeApp()) return null;
  return LocalNotifications;
}

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
  const ln = await plugin();
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
// TEMPORARY: records where the last sync got to, so the on-screen diagnostic
// can report it. Delete alongside reminderDiagnostics().
let lastSync = "never ran";
let syncRuns = 0;
export function lastSyncReport(): string {
  return `runs=${syncRuns} ${lastSync}`;
}

// Fingerprint of the last schedule actually written, so an identical request is
// a no-op.
//
// THIS IS THE FIX, not an optimisation. syncClockReminders cancels our whole id
// range before scheduling — so if it's called repeatedly with the same input
// (a layout re-render, a router.refresh, a poll), each run wipes the previous
// run's notifications before they can fire. Nothing survives, pending stays 0,
// and the failure is invisible.
//
// It went unnoticed because the diagnostic probe used id 9999, which is NOT in
// the cancelled range — so the probe queued and delivered perfectly while the
// real reminders were being destroyed on a loop.
let lastFingerprint = "";

export async function syncClockReminders(
  reminders: ClockReminder[]
): Promise<void> {
  syncRuns += 1;

  const fingerprint = reminders.map((r) => `${r.id}@${r.at}`).join("|");
  if (fingerprint === lastFingerprint) {
    lastSync = `n=${reminders.length} unchanged`;
    return;
  }

  // TEMPORARY: bump whenever these breadcrumbs change, so the report itself
  // says whether the device is running the JS we just shipped. Without it, "old
  // cached bundle" and "new code that hung before the first breadcrumb" produce
  // an identical string, which cost a round trip once already.
  lastSync = `v5 n=${reminders.length}`;

  // Three outcomes here, and `v3` could distinguish none of them — all three
  // left the report frozen at "→plugin":
  //
  //   1. plugin() REJECTS. isNativeApp() runs outside plugin()'s own try/catch,
  //      and `await plugin()` used to sit outside this function's, so a throw
  //      escaped all the way into the caller's `void syncClockReminders(...)`
  //      as an unhandled rejection — invisible, and identical to a hang.
  //   2. plugin() never SETTLES (a chunk that never arrives).
  //   3. plugin() resolves null (not native, or the import failed).
  //
  // The race turns 2 into an observable result rather than silence, and the
  // catch turns 1 into a message. Worth keeping the catch after the diagnostic
  // goes: this module promises it can never break the clock, and an escaping
  // rejection breaks that promise.
  lastSync += " →plugin";
  let ln: Awaited<ReturnType<typeof plugin>> = null;
  try {
    const raced = await Promise.race([
      plugin().then((p) => ({ kind: "settled" as const, p })),
      new Promise<{ kind: "timeout" }>((resolve) =>
        setTimeout(() => resolve({ kind: "timeout" }), 5000)
      ),
    ]);
    if (raced.kind === "timeout") {
      lastSync += " PLUGIN-TIMEOUT(5s)";
      return;
    }
    ln = raced.p;
  } catch (e) {
    lastSync += ` PLUGIN-THREW: ${(e as Error)?.message ?? String(e)}`;
    return;
  }
  if (!ln) {
    lastSync += " NO-PLUGIN";
    return;
  }
  lastSync += " ok";

  try {
    // TEMPORARY breadcrumbs. A bare `n=9` in the report means one of the three
    // awaits below never settled, and they're indistinguishable without
    // markers — the arrow goes in BEFORE the call, the check after it, so the
    // last arrow with no check is the one that hung. Delete with the rest of
    // the diagnostic.
    lastSync += " →cancel";
    // Unconditional: cancelling ids that aren't scheduled is a no-op.
    await ln.cancel({ notifications: allReminderIds().map((id) => ({ id })) });
    lastSync += " ok";

    if (reminders.length === 0) {
      // Cancelled above; record it so a later identical call skips even this.
      lastFingerprint = fingerprint;
      lastSync += " (nothing to schedule)";
      return;
    }
    lastSync += " →perm";
    if (!(await canScheduleReminders())) {
      lastSync += " NO-PERM";
      return;
    }
    lastSync += " ok →sched";

    const res = await ln.schedule({
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
    lastSync += ` scheduled=${res?.notifications?.length ?? "?"}`;
  } catch (e) {
    // Still swallowed for the caller — a reminder may never break the clock —
    // but no longer invisible.
    lastSync += ` THREW: ${(e as Error)?.message ?? String(e)}`;
  }
}

// TEMPORARY DIAGNOSTIC — delete once reminders are confirmed working.
//
// Everything above swallows its errors so a reminder can never break the clock,
// which is right for production and useless while debugging: a failure looks
// exactly like nothing happening. This reports each step instead.
//
// Deliberately readable from JS alone, so it ships over Vercel with no Xcode
// rebuild — which is what makes it able to answer the first question that
// matters: is the plugin actually in this binary?
export async function reminderDiagnostics(): Promise<string> {
  if (!isNativeApp()) return "web (reminders are native-only)";

  // Static now, like plugin(). This call site's dynamic import was the one that
  // DID resolve, which is what made the failure so confusing to read: the
  // report said "plugin ok" and "PLUGIN-TIMEOUT" in the same breath.
  const ln = LocalNotifications;
  if (!ln) return "PLUGIN MISSING — rebuild in Xcode";

  let perm = "?";
  try {
    perm = (await ln.checkPermissions()).display;
  } catch (e) {
    return `checkPermissions threw: ${(e as Error)?.message ?? "?"}`;
  }

  let pending = -1;
  try {
    pending = (await ln.getPending()).notifications.length;
  } catch (e) {
    return `getPending threw: ${(e as Error)?.message ?? "?"}`;
  }

  // A live schedule attempt 30s out. This is the decisive test: if the bridge
  // can't turn a JS Date into a usable trigger, iOS treats the request as
  // "deliver now" instead of queueing it, which reads as pending=0 with no
  // error anywhere. Scheduling one and re-reading pending distinguishes
  // "scheduling failed" from "scheduling worked but delivery didn't".
  // The probe already proved scheduling works, so it's gone — re-running it
  // every 3s would queue a test notification repeatedly. What matters now is
  // the settled pending count and where the leaf's sync finished.
  const ids = (await ln.getPending()).notifications
    .map((n) => n.id)
    .sort((a, b) => a - b)
    .join(",");

  return `plugin ok · perm=${perm} · pending=${pending}${
    pending > 0 ? ` [${ids}]` : ""
  } · sync[${lastSyncReport()}]`;
}

// Clear everything this module owns. Used when a session ends by any route.
export async function cancelClockReminders(): Promise<void> {
  const ln = await plugin();
  if (!ln) return;
  try {
    await ln.cancel({ notifications: allReminderIds().map((id) => ({ id })) });
  } catch {
    // Swallowed on purpose.
  }
}
