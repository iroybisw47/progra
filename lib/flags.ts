import { SESSION_CAP_MS } from "@/lib/session";

// Feature flags for Progra. Flags let unfinished work ship to production "dark"
// — present in the bundle but unreachable — so small fixes keep deploying off
// main while a large feature (the social v2 build) lands piece by piece.
//
// NEXT_PUBLIC_ so the same value is readable from both Server and Client
// Components. It's inlined at build time, so flipping a flag takes a redeploy —
// which is the point: a deliberate, reviewable switch, not a live toggle.

function envFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

// Master switch for the V2 information architecture (the design_handoff_progra_v2
// restructure): the Progress/Feed/Friends/You nav, the Progress tab, the Settings
// hub, the standalone Categories page, the Session detail page, etc. The V2 *theme*
// (white/navy/PT Sans tokens) is applied globally regardless — only the structural
// rebuild is gated here. Flip to `:root`-level once every screen is migrated.
export const REDESIGN = envFlag(process.env.NEXT_PUBLIC_REDESIGN);

// Master switch for the friends-based social network (v2). While false, every
// social route/UI stays hidden and Progra behaves as the single-user tracker
// current beta users know. The redesign is built for the social-on end state
// (Feed/Friends/You are core tabs, profiles are linked everywhere), so REDESIGN
// implies SOCIAL_ENABLED — otherwise enabling only REDESIGN would 404 those
// tabs. See the roadmap in .claude/plans.
export const SOCIAL_ENABLED =
  envFlag(process.env.NEXT_PUBLIC_SOCIAL_ENABLED) || REDESIGN;

// Master switch for the "Refer a friend" entry point on Progress and the
// /refer share screen it opens. Kept independent of SOCIAL_ENABLED so the
// referral push can be turned on and off on its own — note the link it shares
// (/i/{username}) only resolves while social is on, since that page 404s
// otherwise.
export const REFER_ENABLED = envFlag(process.env.NEXT_PUBLIC_REFER_ENABLED);

// Master switch for OFFERING the Google Calendar connection.
//
// Dark for the first App Store submission. `calendar.events.readonly` is a
// SENSITIVE Google scope, so until the OAuth app clears verification two things
// are true: every consent screen shows "Google hasn't verified this app" with
// "Go to progra.world (unsafe)" as the way forward, and Google caps the app at
// 100 users who have granted the scope — which contradicts a 250-seat beta the
// moment it fills.
//
// This gates the ability to CONNECT, not the feature. Anyone already connected
// keeps their synced events, keeps the sync button, and keeps Disconnect —
// withdrawing access is promised in the privacy policy and must never depend on
// a flag.
//
// Flip to "1" (and NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING to "0") once Google's
// verification clears.
export const CALENDAR_CONNECT = envFlag(
  process.env.NEXT_PUBLIC_CALENDAR_CONNECT
);

// Master switch for timed clock-in: a work target plus optional breaks, as an
// alternative to the open-ended "stop when you stop" session.
//
// While false, Clock in behaves exactly as it always has and every timed-session
// column stays null — which is also true of every session that already exists,
// so the two paths are the same code path with the plan omitted.
//
// Built across several passes, so this exists to let the unfinished middle ship
// to production dark rather than sitting on a long-lived branch.
export const TIMED_SESSIONS = envFlag(process.env.NEXT_PUBLIC_TIMED_SESSIONS);

// Master switch for on-device clock reminders: an hourly nudge on open-ended
// sessions, and a single alert when a timed session reaches its target.
//
// Deliberately INDEPENDENT of TIMED_SESSIONS. The hourly nudge applies to
// open-ended sessions, which is what every user has today — so without its own
// flag, shipping the native build that adds the plugin would start notifying
// the whole beta group with no warning.
//
// Accepts one extra value beyond the usual 1/true: "fast", which shortens an
// "hour" to two minutes so the hourly nudge can actually be tested. Verifying
// it otherwise costs a real hour per attempt, which means in practice it would
// ship unverified. A distinct value rather than a second boolean, so it can't
// be switched on by accident — but production must be set to "1", not "fast".
const CLOCK_REMINDERS_RAW = process.env.NEXT_PUBLIC_CLOCK_REMINDERS;
export const CLOCK_REMINDERS_FAST = CLOCK_REMINDERS_RAW === "fast";
export const CLOCK_REMINDERS =
  envFlag(CLOCK_REMINDERS_RAW) || CLOCK_REMINDERS_FAST;

// Master switch for the daily habit reminder: an on-device notification at a
// user-chosen time (default 18:00) on days with unchecked habits. Ships dark
// for the same reason CLOCK_REMINDERS did — default-on for everyone with
// permission granted, so flipping it is a deliberate announcement, not a side
// effect of a deploy.
//
// No "fast" mode: unlike the hourly nudge, the fire time is user-settable, so
// it's tested by picking a time two minutes out.
export const HABIT_REMINDERS = envFlag(process.env.NEXT_PUBLIC_HABIT_REMINDERS);

// Master switch for server-sent social pushes ("X liked your session") AND
// the Settings row that opts out of them. NEXT_PUBLIC_ per this file's
// convention — the toggle row is client-gated, and the server-side sender
// reads the same inlined constant. Ships dark; delivery additionally requires
// the APNS_* server env vars, so flipping this without them is a logged no-op.
export const SOCIAL_PUSH = envFlag(process.env.NEXT_PUBLIC_SOCIAL_PUSH);

// Master switch for the weekly-recap push ("Your week is ready", Sunday 6pm in
// the user's own timezone). Read by app/api/cron/recap-ready/route.ts, which
// no-ops when it's off — so the schedule can be created and observed in
// production before a single buzz reaches anyone. Delivery additionally needs
// the APNS_* env vars, like SOCIAL_PUSH.
//
// NEXT_PUBLIC_ per this file's convention even though nothing client-side reads
// it: every flag here is inlined at build time, and a bare process.env read in
// a route handler would diverge from how the rest of the file behaves.
//
// Opting out is the SOCIAL_PUSH switch, not a second column — see
// lib/push/send-recap-push.ts.
export const RECAP_PUSH = envFlag(process.env.NEXT_PUBLIC_RECAP_PUSH);

// Master switch for nudges: the button on a friend's profile, the target/preset
// sheet, the rows in the notifications panel and the Settings opt-out. Implies
// SOCIAL_ENABLED — a nudge is friends-only, so it can't mean anything with the
// social layer dark. The PUSH half additionally needs SOCIAL_PUSH: with this on
// and that off, a nudge still lands in the panel, it just doesn't buzz.
export const NUDGES =
  envFlag(process.env.NEXT_PUBLIC_NUDGES) && SOCIAL_ENABLED;

// Master switch for replies to comments: the Reply control and threads on the
// session page, the "replied to you" panel rows, and reply pushes. Implies
// SOCIAL_ENABLED — replies only exist inside the social layer. The PUSH half
// additionally needs SOCIAL_PUSH. Off, the page reads and renders exactly as
// before: the reader doesn't even select the thread columns, so this can't
// break comments if it's flipped before the hand-run SQL has been applied.
export const COMMENT_REPLIES =
  envFlag(process.env.NEXT_PUBLIC_COMMENT_REPLIES) && SOCIAL_ENABLED;

// Master switch for John: the instrumentation that collects the inputs a weekly
// AI insights backend will need — an intention at clock-in, an outcome + focus
// rating + phone-distraction tap at clock-out, a pause counter, an optional goal
// deadline, and a reason for a missed habit.
//
// THIS FLAG MEANS "THE SQL HAS RUN", NOT "WHO CAN SEE IT". Who sees it is
// profiles.john_enabled, a per-user column flipped with one UPDATE in the SQL
// editor — which is how a two-person test is possible at all, since every flag
// in this file is a build-time global.
//
// Flipping this ON before .claude/plans/john-instrumentation.sql STEP 1 has run
// is the one dangerous ordering: the flagged selects would 42703, PostgREST
// would return nothing, and the finish screen plus the goals read would break
// for ALL users, not just the cohort. Off, no reader selects a new column, so
// the app is safe to deploy ahead of the SQL.
//
// Off is also the kill switch: isJohnUser() is `JOHN && john_enabled === true`,
// so flipping this false ends the test for everyone without touching the DB.
export const JOHN = envFlag(process.env.NEXT_PUBLIC_JOHN);

// How long an "hour" is for the hourly nudge. Only ever anything else in test
// mode; lib/clock-reminders.ts stays pure and takes this as an argument rather
// than reading the flag itself.
export const REMINDER_HOUR_MS = CLOCK_REMINDERS_FAST ? 2 * 60_000 : 60 * 60_000;

// The session cap, shortened alongside the hour in `fast` mode.
//
// Without this the cap would stay 10 real hours while an "hour" became 2
// minutes, so the auto-clock-out reminder could only be verified by leaving a
// session running for a working day — the exact wait fast mode exists to
// remove. 20 minutes is (MAX_HOURLY_REMINDERS + 1) × 2 min, which preserves the
// real relationship: the cap sits exactly one interval past the last nudge.
export const REMINDER_CAP_MS = CLOCK_REMINDERS_FAST
  ? 20 * 60_000
  : SESSION_CAP_MS;
