import {
  liveActivityFingerprint,
  type LiveActivitySnapshot,
} from "@/lib/live-activity";
import { liveActivityPlugin } from "@/lib/native-plugins";

// The ONLY file that talks to the Live Activity plugin.
//
// Same split as lib/notification-sync.ts: a pure module decides what the card
// shows (lib/live-activity.ts, tested), and this hands it to iOS. Three of that
// engine's four invariants carry over unchanged —
//
//   * the fingerprint guard, initialised to null and NOT "",
//   * recorded only once the call has actually resolved,
//   * every error swallowed,
//
// — and one is deliberately absent: there is NO permission gate. Live Activities
// require no UNUserNotificationCenter authorization, so the card works for users
// who denied notifications. Given lib/notification-permission.ts's "the dialog
// shows once, ever, and denied is terminal", that's a real share of the beta, and
// it's also why this stays a separate leaf from SyncClockReminders rather than
// being folded into it: one surface is permission-gated and one isn't.
//
// A null snapshot means "end whatever is showing", so teardown is the degenerate
// case of the same call and there is no separate path to forget — exactly
// clockReminders returning [].
//
// EVERY call is safe to make unconditionally: on the web, on a binary that
// predates the plugin, or with Live Activities switched off in Settings. The card
// is a nicety and may never break the session it decorates.

// Fingerprint of the last payload actually written.
//
// null, NOT "": a Live Activity SURVIVES a force-quit and sits on the Lock Screen
// with its own buttons. The first sync after a relaunch must therefore always
// act, or a card from a previous run persists showing a stale session — and in
// Phase 2 that card's buttons would carry a stale sessionId. The argument is the
// same one notification-sync.ts makes, only with a worse failure at the end of
// it.
let last: string | null = null;

export async function syncLiveActivity(
  snapshot: LiveActivitySnapshot | null
): Promise<void> {
  const fingerprint = liveActivityFingerprint(snapshot);
  if (fingerprint === last) return;

  const la = liveActivityPlugin();
  if (!la) return;

  try {
    await la.sync({ snapshot });
    // Only after the write succeeded. Activity.request throws when the user has
    // disabled Live Activities for the app or the system limit is hit, and
    // update() throws on an activity iOS has already dismissed — a throw must
    // leave the fingerprint stale so the NEXT transition retries rather than
    // being skipped as unchanged.
    last = fingerprint;
  } catch {
    // Swallowed on purpose.
  }
}

// Tear the card down, bypassing the fingerprint.
//
// Needed because the one-leaf-in-the-layout pattern has exactly two blind spots:
// clockOut and the edit-that-ends both call revalidateSessionSurfacesExceptLive(),
// which deliberately skips the layout, so the leaf never re-renders and never
// observes the session ending. For notifications the cost is a stale nav ticker;
// here it would be a Lock Screen card claiming a running session, with live
// buttons, after clock-out. Also the sign-out/account-deletion path, which a
// leaf gated on `user` can never see.
//
// Idempotent, so the later full revalidation re-firing is free.
export async function endLiveActivity(): Promise<void> {
  const la = liveActivityPlugin();
  if (!la) return;
  try {
    await la.sync({ snapshot: null });
    last = null;
  } catch {
    // Swallowed on purpose.
  }
}
