// Whether clock reminders are on for the CURRENT session, on THIS device.
//
// Per-device rather than an account setting, matching the mute control that
// sits a few pixels away on the same screen: notifications are scheduled on the
// device, so "off" is a statement about this phone, not about the user. That
// also means no column, no server action, and no new prop threaded through the
// root layout.
//
// Per-SESSION rather than a standing preference, because the ask is "not for
// this one" — someone silencing a late-night session should not have to
// remember to turn it back on tomorrow.
//
// The stored value is THE SESSION ID REMINDERS ARE OFF FOR, not a boolean. That
// single choice is what makes the reset free: a new session has a new id, the
// id no longer matches, and the default is back to on with no expiry logic and
// no stale keys accumulating.

const KEY = "progra.clock-reminders.off";
const EVENT = "progra:clock-reminders-pref";

// PURE, so the whole decision is testable without a browser — the browser state
// comes in as an argument. Same shape as lib/pwa-install.ts.
export function remindersEnabledFor(
  stored: string | null,
  sessionId: string | null
): boolean {
  if (stored === null || sessionId === null) return true;
  return stored !== sessionId;
}

export function remindersEnabled(sessionId: string | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    return remindersEnabledFor(window.localStorage.getItem(KEY), sessionId);
  } catch {
    // Storage throws in private modes. Treat it as on rather than let a
    // preference read silence someone's reminders.
    return true;
  }
}

export function setRemindersEnabled(
  sessionId: string,
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, sessionId);
  } catch {
    // Ignore — the toggle still works for this page's lifetime via the event.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeRemindersEnabled(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, onChange);
  // Another tab toggling it should update this one too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
