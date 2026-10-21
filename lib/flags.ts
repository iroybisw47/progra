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

// Master switch for the "Your week is ready" nudge at the top of Progress, the
// in-app way into the weekly recap story (/recap/[weekStart], where a week is
// posted to the feed). Off since 2026-10-11, the Sunday a new weekly review
// started being built: that evening's recap, and each one after it, goes
// unannounced until the new review replaces it. On brings the nudge back
// exactly as it was. Off, Progress doesn't even read whether the week was
// opened. Nothing else changes: the story and the /recap browse page (History
// links it) still work, and the push this would pair with is RECAP_PUSH.
export const RECAP_NUDGE = envFlag(process.env.NEXT_PUBLIC_RECAP_NUDGE);

// Master switch for the weekly review: the eight-slide recap story built from
// design_handoff_weekly_recap (Loading, Hours tracked, Where it went, Weekly
// goals, Habits, Friends, Your rank, Closing; plan .claude/plans/recap-v2.md).
// On:
//   - From Monday 06:00 in the user's own timezone, the review of the week that
//     just ended OPENS BY ITSELF the next time Progress (`/`) renders, in place
//     of the Progress tab, until the user closes it once (recap_views marks it,
//     on close rather than on open, so quitting the app mid-story shows it again).
//   - /recap/[weekStart] renders the new story instead of the old one.
// Off, both are exactly as before: the old five-panel story at
// /recap/[weekStart], no auto-open. The old nudge stays behind RECAP_NUDGE.
//
// THIS FLAG MEANS ".claude/plans/recap-v2.sql STEP 1 HAS RUN" (since the Share
// slide, 2026-10-12): posting a week writes recap_posts' new goal/habit
// columns. Flipped early, nothing breaks — a post toasts a generic error and
// the feed falls back to the old columns — but nobody can post. Everything
// else is existing tables under RLS (recap_reactions.created_at was already
// there: STEP 0, 2026-10-12).
//
// Also: the Share slide ("Share your week", just before Closing) posts the
// week to friends' feeds; the post shows on You and profiles and opens at
// /review/[id]; likes and comments on it reach the notifications panel, and
// a push when SOCIAL_PUSH is on.
// Implies REDESIGN: it replaces what the redesign's Progress tab renders.
// Needs no new binary either: the navy slides' light status bar goes through
// Capacitor's built-in SystemBars plugin, in every shipped build.
export const RECAP_V2 = envFlag(process.env.NEXT_PUBLIC_RECAP_V2) && REDESIGN;

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

// Master switch for the UW cohort: onboarding v3's "UW student?" tiles and
// majors/interests quick-add on Screen 1, the UW groups on Screen 5 and the
// Friends tab ("In {major}", "Shares your interests", "More at UW"), and the
// Settings block that lets an already-onboarded user join or leave. v2's UW
// step is gone (plan P9a), so v2 runs without UW whatever this says.
//
// THIS FLAG MEANS ".claude/plans/uw-cohort.sql STEP 5 HAS RUN, AND ITS 5V AND
// 5A BLOCKS PASSED" — not merely STEP 1. Flipping it on any earlier is the
// one dangerous ordering: setUwProfile would name uw_majors, uw_interests and
// uw_listed, which don't exist yet, list_uw_peers would not exist, and before
// 5A the roster exposure it gates is unproven (plan D2). Off, no writer names
// a UW column and no reader calls a UW RPC, so the app is safe to deploy ahead
// of the SQL. Flip it after ONBOARDING_V3 is on and all of P9 is deployed.
//
// Unlike JOHN there is no per-user column deciding who sees it: membership IS
// the per-user column (profiles.is_uw), and the user sets it themselves. Who
// appears to OTHER students is a second one, profiles.uw_listed, off by
// default and set only by the student.
export const UW = envFlag(process.env.NEXT_PUBLIC_UW);

// Master switch for onboarding v3: the six-screen wizard (who you are, goals,
// habits, a three-beat intro, find friends, "Ready?") that hands off to the
// normal Clock tab with the first goal preselected. On, it replaces v2 at `/`
// (first run) and `/onboarding` (Replay). Off, v2 runs exactly as it does
// today — and it stays the fallback for a release after the flip, so turning
// this back off is the rollback. See .claude/plans/onboarding-v3.md.
//
// Implies REDESIGN: v3 replaces the v2 wizard, which only exists under REDESIGN,
// and it lands on the redesign's Clock tab with the BottomNav rising in.
//
// THIS FLAG NEEDS NO SQL, unlike JOHN, UW and ANALYTICS. Every write it makes
// goes through an action and a column that already exist (handles, goals,
// habits, categories, friend requests), so it means "verified signed in", not
// "the SQL has run". Its UW parts are gated on UW as well, and that one does.
export const ONBOARDING_V3 =
  envFlag(process.env.NEXT_PUBLIC_ONBOARDING_V3) && REDESIGN;

// Master switch for the v3 Friends tab: search, the breathing invite button,
// Requests, the UW groups and "Your friends" with this week's hours, in the
// same visual language as onboarding v3's find-your-friends screen. Off,
// /friends renders the current layout unchanged.
//
// Its own flag rather than ONBOARDING_V3's because the two reach different
// people: onboarding only meets new signups and Replay, while every user opens
// /friends every day. Each can be approved, and rolled back, on its own.
//
// Implies SOCIAL_ENABLED — /friends 404s with the social layer dark. NEEDS NO
// SQL either: it reads the friendships, profiles and sessions the current tab
// already reads, and its UW groups stay behind UW.
export const FRIENDS_V3 =
  envFlag(process.env.NEXT_PUBLIC_FRIENDS_V3) && SOCIAL_ENABLED;

// Master switch for the iOS Live Activity: the Lock Screen / Dynamic Island card
// for a running clock-in session.
//
// THIS FLAG MEANS "THE BINARY IS OUT", and it is the sequencing mechanism rather
// than a nicety. capacitor.config.ts points the shell at https://progra.world, so
// the whole TypeScript half can deploy to every user the moment it's written —
// while the native plugin that consumes it is still in App Store review. Off,
// nothing calls the bridge.
//
// It stays useful after launch as the kill switch: a user on an older binary gets
// the newer JS, and the accessor contract already makes that a no-op (the plugin
// is simply absent from window.Capacitor.Plugins) — but a payload shape the
// shipped binary mishandles is only fixable from here.
export const LIVE_ACTIVITY = envFlag(process.env.NEXT_PUBLIC_LIVE_ACTIVITY);

// Master switch for the internal analytics pipeline: the client event logger
// (lib/telemetry/client.ts → POST /api/analytics/events), the per-screen
// writers (onboarding step, profile views, device state) and the root-layout
// lifecycle leaf that records app opens.
//
// THIS FLAG MEANS "THE SQL HAS RUN", like JOHN and UW:
// .claude/plans/analytics/phase1.sql creates every table and column the writers
// name. Off, track() makes zero network calls, the ingest route answers 204 and
// drops the batch, and every writer action returns early — so the TypeScript
// half is safe to deploy ahead of the SQL. It is also the kill switch: flipping
// it off stops collection on the next deploy without touching the database.
export const ANALYTICS = envFlag(process.env.NEXT_PUBLIC_ANALYTICS);

// Master switch for streaks (.claude/plans/streaks.md): the fire badge by your
// name on /me and on a friend's profile, its sheet, the announcement card, the
// settle leaf, and the streak pushes (those also need SOCIAL_PUSH).
//
// THIS FLAG MEANS "THE SQL HAS RUN": .claude/plans/streaks.sql STEP 1 creates
// the tables and RPCs every reader names. It does NOT start the counting. That
// is the launch date (lib/streaks-config.ts STREAK_LAUNCH_DATE, mirrored by
// streak_config.launch_date), and until it arrives the surfaces show the
// announcement and no numbers. The database also has its own kill switch,
// streak_config.enabled: off, every streak RPC returns null whatever this says.
//
// Independent of SOCIAL_ENABLED on purpose: a person with no friends still has
// a streak. Only the friend-profile badge needs the social layer.
export const STREAKS = envFlag(process.env.NEXT_PUBLIC_STREAKS);

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
