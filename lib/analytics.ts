// Product analytics events — the entry point every call site uses.
//
// `track(name, props)` is the same call it has always been; what changed is
// where it goes. Events now land in app_events in Progra's OWN Supabase via
// lib/telemetry/client.ts → POST /api/analytics/events, read only by the admin
// dashboard. There is no third-party analytics SDK any more. Keeping this
// path and signature is why the two dozen call sites did not change when
// PostHog went.
//
// The event names and the exact properties each may carry are the closed table
// in lib/telemetry/events.ts, and that file is also the privacy boundary: no
// property type accepts free text, so a goal title or a comment body cannot be
// tracked even by accident.
//
// Events are captured CLIENT-side at the point the user completes something,
// rather than server-side in the actions. Actions are called from several
// paths and some (autoClockOut, completePlannedSession) fire without the user
// doing anything, which would inflate the numbers.

export type { AnalyticsEvent, TrackProps } from "@/lib/telemetry/events";
export { track } from "@/lib/telemetry/client";
