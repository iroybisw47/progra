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
export const CLOCK_REMINDERS = envFlag(process.env.NEXT_PUBLIC_CLOCK_REMINDERS);
