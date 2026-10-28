// The "Turn on notifications?" sheet (components/v2/notify-prompt-on-load.tsx):
// what it says, and when it's due.
//
// Who it's for: members whose phone has never answered iOS's notification
// dialog (`prompt`), plus the few who said no (`denied`), who get a route to iOS
// Settings instead. iOS asks once, ever, so the sheet is the explanation that
// earns the ask; it is never the ask itself until someone taps.
//
// When is per device, in localStorage, with no column and no SQL: the
// permission it's about is a fact about this phone, not the account (the same
// call as lib/reminder-prefs.ts). Losing the record only means the sheet can
// come back sooner.

// Every clause is a notification that actually reaches someone today, so the
// sheet never promises a buzz nobody sends. Pure and flag-free: the flags come
// in as an argument so each combination is testable.
export type NotifyPromptFlags = {
  clockReminders: boolean;
  streaks: boolean;
  socialPush: boolean;
  nudges: boolean;
  rally: boolean;
};

// null when nothing would arrive, and then the sheet doesn't show at all.
export function notifyPromptBody(flags: NotifyPromptFlags): string | null {
  const clauses: string[] = [];
  if (flags.clockReminders) {
    clauses.push("a heads-up when your clock-in time is up");
  }
  // The streak reminder and every friend ping are server pushes, which also
  // need SOCIAL_PUSH (lib/push/send-streak-push.ts, send-nudge-push.ts).
  if (flags.streaks && flags.socialPush) {
    clauses.push("a reminder before your streak breaks");
  }
  if (flags.socialPush) {
    clauses.push(
      flags.rally
        ? "a ping when a friend cheers you on"
        : flags.nudges
          ? "a ping when a friend nudges you"
          : "a ping when a friend likes your session"
    );
  }
  if (clauses.length === 0) return null;
  return `Get ${joinClauses(clauses)}.`;
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;
}

// At most three times, a week apart, and never on a member's first day: a
// brand-new account has just been through onboarding's own notifications
// screen, and asking again on the next screen is nagging.
export const NOTIFY_PROMPT_MAX_SHOWS = 3;
export const NOTIFY_PROMPT_GAP_MS = 7 * 24 * 60 * 60_000;
export const NOTIFY_PROMPT_GRACE_MS = 24 * 60 * 60_000;

type ShowRecord = { shown: number; lastAt: number };

function parseRecord(stored: string | null): ShowRecord {
  if (stored === null) return { shown: 0, lastAt: 0 };
  try {
    const r = JSON.parse(stored) as Partial<ShowRecord>;
    const shown = Number.isFinite(r.shown) ? Number(r.shown) : 0;
    const lastAt = Number.isFinite(r.lastAt) ? Number(r.lastAt) : 0;
    return { shown, lastAt };
  } catch {
    // Unreadable means someone (or something) wrote junk: treat it as never
    // shown rather than lock the sheet out forever.
    return { shown: 0, lastAt: 0 };
  }
}

// PURE: the browser state comes in as arguments.
export function notifyPromptDue(
  stored: string | null,
  onboardedAtMs: number | null,
  nowMs: number
): boolean {
  if (onboardedAtMs === null || !Number.isFinite(onboardedAtMs)) return false;
  if (nowMs - onboardedAtMs < NOTIFY_PROMPT_GRACE_MS) return false;
  const r = parseRecord(stored);
  if (r.shown >= NOTIFY_PROMPT_MAX_SHOWS) return false;
  return r.shown === 0 || nowMs - r.lastAt >= NOTIFY_PROMPT_GAP_MS;
}

// What closing the sheet writes, by any path.
export function nextNotifyPromptRecord(
  stored: string | null,
  nowMs: number
): string {
  const r = parseRecord(stored);
  return JSON.stringify({ shown: r.shown + 1, lastAt: nowMs });
}

const KEY = "progra.notify-prompt";
const EVENT = "progra:notify-prompt";

export function notifyPromptDueNow(onboardedAt: string | null): boolean {
  if (typeof window === "undefined") return false;
  const onboardedAtMs = onboardedAt === null ? null : Date.parse(onboardedAt);
  try {
    return notifyPromptDue(
      window.localStorage.getItem(KEY),
      onboardedAtMs,
      Date.now()
    );
  } catch {
    // Storage throws in private modes. Then there's no way to remember a
    // "Not now", so don't show something that would come back every load.
    return false;
  }
}

export function recordNotifyPromptShown(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      nextNotifyPromptRecord(window.localStorage.getItem(KEY), Date.now())
    );
  } catch {
    // Ignore: the sheet still closes for this page's lifetime.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeNotifyPrompt(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
