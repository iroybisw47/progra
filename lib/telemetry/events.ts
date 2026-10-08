// The closed list of analytics events and, per event, the exact properties
// each may carry. Pure and shared: the client validates before enqueueing, the
// ingest route validates again before anything touches the database, and the
// test pins both to this one table.
//
// THE RULE THIS FILE ENFORCES: no free text, ever. A property value is a UUID,
// an integer, a boolean, a clock time, or a member of a closed enum — nothing
// else can pass validateEvent(). Goal titles, task names, intentions, comment
// bodies and usernames therefore cannot reach app_events even by accident,
// because there is no property type that would accept them. Add a new type
// here only if it is just as closed.

import { STEPS } from "@/lib/onboarding";
import { NUDGE_PRESET_KEYS, PRAISE_PRESET_KEYS } from "@/lib/social/nudges";
import { isUuid } from "@/lib/validate";

// Routes a bug report can name. A pathname is normalized to one of these (or
// "/other") BEFORE it becomes a property, so a `/profile/maya` never leaves the
// device as anything but `/profile/[username]`.
export const ROUTES = [
  "/",
  "/feed",
  "/clock",
  "/clock/live",
  "/clock/finish",
  "/me",
  "/friends",
  "/profile/[username]",
  "/goals",
  "/habits",
  "/history",
  "/recap",
  "/recap/[weekStart]",
  "/recap/[weekStart]/card",
  "/sessions",
  "/session/[id]",
  "/categories",
  "/settings",
  "/onboarding",
  "/refer",
  "/search",
  "/support",
  "/i/[username]",
  "/login",
  "/privacy",
  "/terms",
  "/admin",
  "/admin/analytics",
  "/other",
] as const;

export function normalizeRoute(pathname: string): (typeof ROUTES)[number] {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const templated = path
    .replace(/^\/profile\/[^/]+$/, "/profile/[username]")
    .replace(/^\/session\/[^/]+$/, "/session/[id]")
    .replace(/^\/recap\/[^/]+\/card$/, "/recap/[weekStart]/card")
    .replace(/^\/recap\/[^/]+$/, "/recap/[weekStart]")
    .replace(/^\/i\/[^/]+$/, "/i/[username]");
  return (ROUTES as readonly string[]).includes(templated)
    ? (templated as (typeof ROUTES)[number])
    : "/other";
}

export const PERMISSION_STATES = [
  "granted",
  "denied",
  "prompt",
  "unavailable",
  // What the onboarding step reports when it never looked.
  "unknown",
] as const;
export const PERMISSION_SOURCES = ["onboarding", "settings", "live_timer"] as const;

// The two on-device reminder toggles, as mirrored to profiles.reminder_prefs by
// syncDeviceState. The clock-reminder pref is per session, so `clock_reminders_off`
// is whether it is off for the session running right now (false when idle).
export type DevicePrefs = {
  clock_reminders_off: boolean;
  habit_reminder_off: boolean;
  habit_reminder_time: string;
};
export const NUDGE_REASONS = [
  "cooldown",
  "unavailable",
  "disabled",
  "too_early",
  "in_session",
  "done_today",
  "nothing_to_nudge",
] as const;
export const NOTIFICATION_TYPES = [
  "clock_in_reminder",
  "habit_reminder",
  "like",
  "comment",
  "reply",
  "nudge",
  "recap",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
const NUDGE_PRESETS_ALL = [...NUDGE_PRESET_KEYS, ...PRAISE_PRESET_KEYS] as const;

// A property's type. A readonly string array is a closed enum.
export type PropType =
  | "uuid"
  | "int"
  | "bool"
  | "hhmm"
  | "local_key"
  | readonly string[];

export type EventSchema = Readonly<Record<string, PropType>>;

// Every property is OPTIONAL. The contract is "nothing unknown and nothing
// free", not "everything present" — a missing property must never cost the
// event itself.
export const EVENTS = {
  // --- app lifecycle (components/analytics-lifecycle.tsx) -------------------
  app_opened: { cold: "bool", source: ["launch", "foreground", "notification_tap"] },
  app_backgrounded: { seconds_since_foreground: "int" },

  // --- signed-out surfaces: the ONLY events accepted without a user --------
  landing_viewed: {},
  sign_in_started: { method: ["google", "apple", "password"] },

  // --- onboarding ------------------------------------------------------------
  onboarding_step_viewed: { step_name: STEPS },
  onboarding_step_completed: { step_name: STEPS },
  onboarding_completed: {},

  // --- core actions. Metrics come from the real tables; these add timing and
  //     context only, so each carries ids, never content. ----------------------
  goal_created: { goal_id: "uuid" },
  goal_updated: { goal_id: "uuid" },
  session_clocked_in: {
    session_ref: "uuid",
    goal_id: "uuid",
    category_id: "uuid",
    timed: "bool",
  },
  session_clocked_out: {
    session_ref: "uuid",
    worked_minutes: "int",
    timed: "bool",
    breaks_taken: "int",
  },
  session_cancelled: { session_ref: "uuid" },
  clock_in_screen_opened: {},
  feed_viewed: {},
  habit_checked: { habit_id: "uuid", backfilled: "bool" },
  like_given: { session_ref: "uuid" },
  comment_given: { session_ref: "uuid", depth: ["root", "reply"] },
  friend_request_sent: { target_id: "uuid" },
  friend_added: {
    friendship_id: "uuid",
    from: ["friends_tab", "onboarding", "profile"],
  },
  invite_sent: { method: ["share_sheet", "clipboard"] },

  // --- notifications ---------------------------------------------------------
  // iOS grants permission once, ever, so the grant rate at each surface is the
  // only signal on whether the copy works.
  notification_permission_asked: { source: PERMISSION_SOURCES, result: PERMISSION_STATES },
  notification_permission_skipped: { source: PERMISSION_SOURCES, state: PERMISSION_STATES },
  notification_settings_opened: { source: PERMISSION_SOURCES, state: PERMISSION_STATES },
  clock_reminders_toggled: { enabled: "bool" },
  habit_reminder_toggled: { enabled: "bool" },
  habit_reminder_time_changed: { time: "hhmm" },
  social_pushes_toggled: { enabled: "bool" },
  nudges_toggled: { enabled: "bool" },
  // Local notifications exist only on the device, so scheduling and
  // cancelling are reported from there; `key` is `local:<id>:<atMs>`, which
  // makes a re-sync of the same instant idempotent. `scheduled_for` is epoch ms.
  notification_scheduled: { key: "local_key", type: NOTIFICATION_TYPES, scheduled_for: "int" },
  notification_cancelled: { key: "local_key" },
  // A tap on either family. Remote pushes carry `nid` (the notification_log
  // id); local ones carry `key`.
  notification_tapped: { nid: "uuid", key: "local_key", type: NOTIFICATION_TYPES },

  // --- nudges ----------------------------------------------------------------
  nudge_sheet_opened: {},
  nudge_sent: {
    nudge_id: "uuid",
    kind: ["goal", "habits"],
    preset: NUDGE_PRESETS_ALL,
    pushed: "bool",
  },
  nudge_rejected: { reason: NUDGE_REASONS },
  nudge_locked_tapped: { reason: NUDGE_REASONS },

  // --- comments. The post itself is comment_given above. --------------------
  comment_reply_opened: {},

  // --- feedback. `length` only — the body lives behind an admin RPC. ---------
  bug_report_submitted: { route: ROUTES },
  suggestion_submitted: { length: "int" },
} as const satisfies Record<string, EventSchema>;

export type AnalyticsEvent = keyof typeof EVENTS;

export const EVENT_NAMES = Object.keys(EVENTS) as AnalyticsEvent[];

// Accepted with no signed-in user. Everything else needs an identity, so a
// stranger POSTing to the ingest route can at most record that a landing page
// was seen.
export const SIGNED_OUT_EVENTS: readonly AnalyticsEvent[] = [
  "landing_viewed",
  "sign_in_started",
];

export function isAnalyticsEvent(name: unknown): name is AnalyticsEvent {
  return (
    typeof name === "string" && Object.prototype.hasOwnProperty.call(EVENTS, name)
  );
}

export function isSignedOutEvent(name: AnalyticsEvent): boolean {
  return SIGNED_OUT_EVENTS.includes(name);
}

// What a call site may pass. null/undefined values are dropped, not rejected:
// `goal_id: goal?.id ?? null` is the natural way to write an optional id.
export type TrackProps = Record<
  string,
  string | number | boolean | null | undefined
>;

export type CleanProps = Record<string, string | number | boolean>;

export type ValidationResult =
  | { ok: true; name: AnalyticsEvent; props: CleanProps }
  | { ok: false; reason: string };

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// local:<notification id>:<epoch ms>. The id is one of the reserved ranges in
// lib/clock-reminders.ts / lib/habit-reminders.ts (four digits); the instant
// is 13 digits for every date this app will ever see.
const LOCAL_KEY_RE = /^local:\d{4}:\d{13}$/;
// Integers only, and far below anything that would overflow a Postgres int8
// or read as a timestamp smuggled in by mistake.
const MAX_INT = 2 ** 40;

function checkValue(
  type: PropType,
  value: unknown
): { ok: true; value: string | number | boolean } | { ok: false } {
  if (type === "uuid") {
    return isUuid(value) ? { ok: true, value: value.toLowerCase() } : { ok: false };
  }
  if (type === "int") {
    return typeof value === "number" &&
      Number.isInteger(value) &&
      Math.abs(value) <= MAX_INT
      ? { ok: true, value }
      : { ok: false };
  }
  if (type === "bool") {
    return typeof value === "boolean" ? { ok: true, value } : { ok: false };
  }
  if (type === "hhmm") {
    return typeof value === "string" && HHMM_RE.test(value)
      ? { ok: true, value }
      : { ok: false };
  }
  if (type === "local_key") {
    return typeof value === "string" && LOCAL_KEY_RE.test(value)
      ? { ok: true, value }
      : { ok: false };
  }
  // Closed enum.
  return typeof value === "string" && type.includes(value)
    ? { ok: true, value }
    : { ok: false };
}

// The gate. Unknown event → rejected. Unknown key → the WHOLE event is
// rejected, not just the key: a call site passing something off-schema is a
// bug to surface (the client logs it in development), and silently thinning
// the event would hide it. Wrong type → rejected for the same reason.
export function validateEvent(name: unknown, props: unknown): ValidationResult {
  if (!isAnalyticsEvent(name)) return { ok: false, reason: "unknown event" };
  const schema: EventSchema = EVENTS[name];

  if (props === undefined || props === null) return { ok: true, name, props: {} };
  if (typeof props !== "object" || Array.isArray(props)) {
    return { ok: false, reason: "props must be an object" };
  }

  const clean: CleanProps = {};
  for (const [key, raw] of Object.entries(props as Record<string, unknown>)) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      return { ok: false, reason: `unknown property "${key}"` };
    }
    if (raw === null || raw === undefined) continue;
    const checked = checkValue(schema[key], raw);
    if (!checked.ok) return { ok: false, reason: `bad value for "${key}"` };
    clean[key] = checked.value;
  }
  return { ok: true, name, props: clean };
}
