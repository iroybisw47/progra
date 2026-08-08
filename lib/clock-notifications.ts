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

// Dynamic import for the same reason push-registration.tsx uses one: it keeps
// the native-only plugin out of the web bundle and off the SSR path.
async function plugin() {
  if (!isNativeApp()) return null;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    return LocalNotifications;
  } catch {
    return null;
  }
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
export function lastSyncReport(): string {
  return lastSync;
}

export async function syncClockReminders(
  reminders: ClockReminder[]
): Promise<void> {
  lastSync = `n=${reminders.length}`;
  const ln = await plugin();
  if (!ln) {
    lastSync += " NO-PLUGIN";
    return;
  }

  try {
    // Unconditional: cancelling ids that aren't scheduled is a no-op.
    await ln.cancel({ notifications: allReminderIds().map((id) => ({ id })) });

    if (reminders.length === 0) {
      lastSync += " (nothing to schedule)";
      return;
    }
    if (!(await canScheduleReminders())) {
      lastSync += " NO-PERM";
      return;
    }

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

  let ln;
  try {
    const mod = await import("@capacitor/local-notifications");
    ln = mod.LocalNotifications;
  } catch (e) {
    return `PLUGIN MISSING — rebuild in Xcode (${(e as Error)?.message ?? "?"})`;
  }
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
  const PROBE_ID = 9999;
  let probe = "?";
  try {
    await ln.schedule({
      notifications: [
        {
          id: PROBE_ID,
          title: "Progra test",
          body: "If you see this, scheduling works.",
          schedule: { at: new Date(Date.now() + 30_000) },
        },
      ],
    });
    const after = (await ln.getPending()).notifications.length;
    probe = after > pending ? "QUEUED ok" : "did NOT queue";
  } catch (e) {
    probe = `threw: ${(e as Error)?.message ?? String(e)}`;
  }

  return `plugin ok · perm=${perm} · pending=${pending} · probe=${probe} · sync[${lastSyncReport()}]`;
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
