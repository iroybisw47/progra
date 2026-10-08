"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { ANALYTICS } from "@/lib/flags";
import { STEPS } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { PERMISSION_STATES, type DevicePrefs } from "@/lib/telemetry/events";
import { isUuid } from "@/lib/validate";

// Writers for the internal analytics pipeline that need the caller's identity
// rather than a batch endpoint: each is one self-scoped RPC
// (.claude/plans/analytics/phase1.sql) that can only ever touch rows belonging
// to auth.uid().
//
// Every one of these is a DELIBERATE EXCEPTION to the mutation rule: none calls
// a revalidate*Surfaces() helper, for the same reason touchLastSeen doesn't —
// nothing any user sees reads these columns, and revalidating on every app
// open or profile view would refetch the whole tree each time. Callers ignore
// the result: a missing migration must never toast.
//
// All of them no-op while ANALYTICS is off, which is what makes the code safe
// to deploy ahead of the SQL (the RPCs would not exist yet).

type Result = { ok: true } | { error: string };

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Claims this device's ownerless events for the signed-in user. Idempotent and
// cheap (one indexed UPDATE), so the lifecycle leaf calls it on EVERY signed-in
// open rather than once: a batch that arrived with an expired cookie is stored
// anonymously and picked up here next time.
export async function linkDeviceEvents(deviceId: string): Promise<Result> {
  if (!ANALYTICS) return { ok: true };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(deviceId)) return { error: "Bad device id" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_device_events", {
    p_device: deviceId.toLowerCase(),
  });
  if (error) return { error: "Couldn't link device." };
  return { ok: true };
}

// The onboarding screen the user just entered. A STEP NAME, validated against
// the wizard's own list; the column carries a matching CHECK.
export async function setOnboardingStep(step: string): Promise<Result> {
  if (!ANALYTICS) return { ok: true };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!(STEPS as readonly string[]).includes(step)) return { error: "Bad step" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_onboarding_step", { p_step: step });
  if (error) return { error: "Couldn't record step." };
  return { ok: true };
}

// One row per (viewer, viewed) at most every 30 minutes; the RPC refuses a
// self-view and does the dedupe, so a remount cannot double-count.
export async function recordProfileView(
  viewedUserId: string,
  appSessionId: string | null
): Promise<Result> {
  if (!ANALYTICS) return { ok: true };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(viewedUserId)) return { error: "Bad user id" };
  if (appSessionId !== null && !isUuid(appSessionId)) return { error: "Bad session id" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_profile_view", {
    p_viewed: viewedUserId.toLowerCase(),
    p_app_session: appSessionId?.toLowerCase() ?? null,
  });
  if (error) return { error: "Couldn't record view." };
  return { ok: true };
}

// The device's notification permission plus the two on-device reminder
// toggles, mirrored so the dashboard can read them. The RPC writes only when
// something changed or ten minutes have passed, like touch_last_seen.
export async function syncDeviceState(
  permission: string,
  prefs: DevicePrefs
): Promise<Result> {
  if (!ANALYTICS) return { ok: true };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!(PERMISSION_STATES as readonly string[]).includes(permission)) {
    return { error: "Bad permission" };
  }
  if (
    typeof prefs !== "object" ||
    prefs === null ||
    typeof prefs.clock_reminders_off !== "boolean" ||
    typeof prefs.habit_reminder_off !== "boolean" ||
    typeof prefs.habit_reminder_time !== "string" ||
    !HHMM_RE.test(prefs.habit_reminder_time)
  ) {
    return { error: "Bad prefs" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("sync_device_state", {
    p_permission: permission,
    p_prefs: {
      clock_reminders_off: prefs.clock_reminders_off,
      habit_reminder_off: prefs.habit_reminder_off,
      habit_reminder_time: prefs.habit_reminder_time,
    },
  });
  if (error) return { error: "Couldn't sync device state." };
  return { ok: true };
}
