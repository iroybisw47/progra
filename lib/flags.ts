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

// Master switch for the friends-based social network (v2). While false, every
// social route/UI stays hidden and Progra behaves as the single-user tracker
// current beta users know. See the roadmap in .claude/plans.
export const SOCIAL_ENABLED = envFlag(process.env.NEXT_PUBLIC_SOCIAL_ENABLED);

// Master switch for the V2 information architecture (the design_handoff_progra_v2
// restructure): the Progress/Feed/Friends/You nav, the Progress tab, the Settings
// hub, the standalone Categories page, the Session detail page, etc. The V2 *theme*
// (white/navy/PT Sans tokens) is applied globally regardless — only the structural
// rebuild is gated here. Built for the social-on end state, so treat REDESIGN as
// implying SOCIAL_ENABLED. Flip to `:root`-level once every screen is migrated.
export const REDESIGN = envFlag(process.env.NEXT_PUBLIC_REDESIGN);
