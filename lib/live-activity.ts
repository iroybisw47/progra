import {
  SESSION_CAP_MS,
  plannedEndMs,
  sessionLiveState,
  sessionWorkedMs,
  type SessionPlan,
  type SessionTiming,
} from "@/lib/session";

// WHAT the iOS Live Activity shows for the active session, as data.
//
// Pure on purpose: no Capacitor, no ActivityKit, no `window`, no Date.now. The
// bridge (lib/live-activity-sync.ts) and the layout leaf that drives it
// (components/sync-live-activity.tsx) consume this; everything hard about the
// feature is decided here, where it's testable. Same split as
// lib/clock-reminders.ts.
//
// THE ONE IDEA: this snapshot needs no `now`.
//
// A running session's worked time advances at exactly 1x, so iOS can render a
// self-updating clock from a single anchor —
//
//     anchor = startedAt + pausedMs        (=== plannedEndMs(timing, 0))
//
// and `Text(timerInterval:)` counts up from it with ZERO refreshes. While
// paused, worked time is frozen, so the value is a constant. Every other field
// is likewise a function of stored columns alone.
//
// So liveActivitySnapshot() takes no `now` parameter — a deliberate asymmetry
// with clockReminders(timing, plan, now, …), which needs one to drop marks
// already in the past. Two things fall out of that, and both are the reason it's
// worth stating:
//
//   1. "One update per state transition, not a tick" stops being a discipline
//      someone has to maintain and becomes a property of the signature.
//   2. The fingerprint can cover EVERY field with no risk of a now-driven
//      resync loop — which matters because ActivityKit throttles update bursts.
//
// EVERY USER-VISIBLE STRING LIVES HERE, not in Swift. The binary ships behind
// App Store review; this file ships on a Vercel deploy. Copy in the snapshot is
// copy you can fix in an afternoon. Same reason clock-reminders.ts owns its
// titles and bodies.

// iOS ends a Live Activity after roughly 8 hours of active lifetime, well before
// this app's 10-hour cap. Rather than let the card lie past the point we can
// trust it, `staleAtMs` marks the horizon and the card asks to be opened. The
// cap announcement itself is already covered by SESSION_CAP_ID in
// lib/clock-reminders.ts, so the card was never the only signal.
export const LIVE_ACTIVITY_MAX_MS = 8 * 60 * 60 * 1000;

// Bumped only if the payload's SHAPE changes incompatibly. capacitor.config.ts
// points the shell at https://progra.world, so a Vercel deploy can hand a
// payload to a binary that has never seen it, on a phone that may never update.
// Swift ignores a version it doesn't understand; new fields are additive and
// optional. See the plan's Risks section.
export const LIVE_ACTIVITY_SNAPSHOT_VERSION = 1;

// Which control the secondary button performs. Mirrors the live timer's own
// three-state chrome: during a break, Pause is REPLACED by End break rather
// than sitting there disabled, because pauseSession refuses during a break and
// a Lock Screen card has no way to show that toast.
export type LiveActivityAction = "pause" | "resume" | "endBreak" | "end";

export type LiveActivitySnapshot = {
  snapshotVersion: number;
  sessionId: string;
  // What they typed they were working on — the card's headline.
  label: string;
  // Never "ended": an ended session has no snapshot at all (null), which is how
  // teardown stays the degenerate case of the same call.
  state: "running" | "paused" | "onBreak";
  // The instant iOS counts up from. Shifts later as pauses accumulate, which is
  // exactly what keeps the card agreeing with the on-screen countdown.
  timerAnchorMs: number;
  // Worked ms at the moment of pausing — what to render instead of a live clock
  // while frozen. null while running.
  frozenWorkedMs: number | null;
  // Timed sessions only: the wall-clock instant worked time reaches the target.
  targetEndMs: number | null;
  plannedWorkMs: number | null;
  // When the CURRENT break is due to end. null unless state === "onBreak" —
  // deliberately not set for a manual pause on a session that merely has
  // breakMs configured, since pausedSince is set in both cases.
  breakEndsAtMs: number | null;
  // The decision, not the inputs: Swift renders secondaryLabel and posts
  // secondaryAction, and never branches on `onBreak` itself.
  secondaryAction: Extract<LiveActivityAction, "pause" | "resume" | "endBreak">;
  secondaryLabel: string;
  endLabel: string;
  // Where a tap on the card goes.
  tapPath: string;
  // Where End lands once the session is over — the finish screen, so the
  // session gets posted rather than stranded draft-private.
  endPath: string;
  // Phase 2: where a button falls back to when the silent call can't
  // authenticate. Ships unused in Phase 1 so the ContentState shape doesn't
  // change in a later binary (a non-optional field added later fails to decode
  // an activity started by the earlier one).
  fallbackPath: string;
  // Past this instant the card stops being trustworthy — see LIVE_ACTIVITY_MAX_MS.
  staleAtMs: number;
  staleLabel: string;
  capEndMs: number;
};

const UNTITLED = "Untitled session";

// Matches app/clock/live/page.tsx's own fallback, so the card and the screen
// name the session identically.
function resolveLabel(raw: string): string {
  return raw.trim() || UNTITLED;
}

// null means "nothing to show" — no session, or one that has ended. The bridge
// turns that into `end()`, so there is no separate teardown path to forget.
// Exactly clockReminders returning [].
export function liveActivitySnapshot(
  sessionId: string | null,
  label: string,
  timing: SessionTiming,
  plan: Pick<SessionPlan, "plannedWorkMs" | "breakMs" | "onBreak">,
  // Injected for the same reason clockReminders injects it: `fast` mode
  // shortens the cap to 20 minutes, and the stale horizon has to follow or the
  // fast-mode card never goes stale.
  capMs: number = SESSION_CAP_MS
): LiveActivitySnapshot | null {
  if (sessionId === null) return null;

  const state = sessionLiveState(timing, plan);
  if (state === "ended") return null;

  const paused = state !== "running";
  const capEndMs = timing.startedAt + capMs + timing.pausedMs;

  return {
    snapshotVersion: LIVE_ACTIVITY_SNAPSHOT_VERSION,
    sessionId,
    label: resolveLabel(label),
    state,
    // plannedEndMs(timing, 0) by definition. Written out rather than called so
    // the anchor reads as what it is, with the test asserting they agree.
    timerAnchorMs: timing.startedAt + timing.pausedMs,
    // sessionWorkedMs at the instant the pause began. Reusing it rather than
    // subtracting by hand is what keeps the frozen number identical to the one
    // the live screen shows.
    frozenWorkedMs:
      paused && timing.pausedSince !== null
        ? sessionWorkedMs(timing, timing.pausedSince)
        : null,
    targetEndMs:
      plan.plannedWorkMs !== null
        ? plannedEndMs(timing, plan.plannedWorkMs)
        : null,
    plannedWorkMs: plan.plannedWorkMs,
    breakEndsAtMs:
      state === "onBreak" && timing.pausedSince !== null && plan.breakMs !== null
        ? timing.pausedSince + plan.breakMs
        : null,
    secondaryAction:
      state === "onBreak" ? "endBreak" : state === "paused" ? "resume" : "pause",
    secondaryLabel:
      state === "onBreak" ? "End break" : state === "paused" ? "Resume" : "Pause",
    endLabel: "Clock out",
    tapPath: "/clock/live",
    endPath: `/clock/finish?sid=${sessionId}`,
    fallbackPath: "/clock/live",
    // Never past the cap: beyond it autoClockOut will zero the session, so
    // there is nothing worth showing even if iOS would still allow it.
    staleAtMs: Math.min(timing.startedAt + LIVE_ACTIVITY_MAX_MS, capEndMs),
    staleLabel: "Open Progra",
    capEndMs,
  };
}

// Exported rather than computed inside the bridge — unlike notification-sync.ts,
// which inlines its own. That file's header records why: its fingerprint had to
// grow to cover title and body after a stale body shipped once. Exporting it
// here turns "does it cover enough fields" from a judgement call into a unit
// test (mutate each input singly, assert the fingerprint moves).
export function liveActivityFingerprint(
  snapshot: LiveActivitySnapshot | null
): string {
  if (snapshot === null) return "none";
  // JSON over the whole object: every field is now-independent, so there is no
  // churning term, and a field added later is covered without anyone
  // remembering to extend this.
  return JSON.stringify(snapshot);
}
