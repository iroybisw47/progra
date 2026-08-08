// Timer cues for timed sessions — break start, break end, target reached.
//
// Generated with the Web Audio API rather than shipped as an audio file: no
// binary in the repo, no network fetch, works offline, and a two-note chime is
// a few lines of oscillator. An .mp3 would be the bigger and more fragile
// choice for a beep.
//
// Every export is a no-op on the server and safe to call unconditionally.

const MUTE_KEY = "progra.timer-sound.muted";
// Bumped whenever the mute flag changes, so useSyncExternalStore subscribers
// re-read. Same-tab storage writes don't fire `storage`, hence a custom event.
const MUTE_EVENT = "progra:timer-sound-muted";

export type TimerCue = "breakStart" | "breakEnd" | "finished";

// Note sequences, chosen to be distinguishable without being alarming: rising
// to send you off on a break, falling to call you back, a longer rise for the
// one moment worth celebrating.
const CUES: Record<TimerCue, number[]> = {
  breakStart: [660, 880],
  breakEnd: [880, 660],
  finished: [660, 880, 1174],
};

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    // Some environments refuse construction outright (very old webviews,
    // hardened privacy modes). Sound simply doesn't exist there.
    return null;
  }
  return ctx;
}

// Unlock audio. MUST be called from inside a real user gesture: Safari and
// WKWebView create an AudioContext `suspended`, and a chime fired from a
// setTimeout twenty-five minutes later has no gesture behind it. Called from
// the clock-in tap and from the first pointer press on the live timer (which
// covers reloading mid-session, where the clock-in gesture is long gone).
//
// Idempotent and safe to call on every press.
export function primeTimerSound(): void {
  const ac = audioContext();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume().catch(() => {});
}

export function isTimerSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // Storage can throw in private modes. Treat it as un-muted rather than
    // letting a preference read break the timer.
    return false;
  }
}

export function setTimerSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore — the toggle still works for this page's lifetime via the event.
  }
  window.dispatchEvent(new Event(MUTE_EVENT));
}

export function subscribeTimerSoundMuted(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MUTE_EVENT, onChange);
  // Another tab toggling it should update this one too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(MUTE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Play a cue. Deliberately swallows everything: a blocked or unavailable
// AudioContext must never break a break transition — the schedule has to keep
// working even when the sound doesn't.
export function playTimerCue(cue: TimerCue): void {
  if (isTimerSoundMuted()) return;

  // Best-effort haptic alongside. navigator.vibrate is unsupported in Safari
  // and WKWebView, so this silently does nothing on iPhone — which is exactly
  // where it would be most useful. Android and desktop Chrome get it.
  try {
    navigator.vibrate?.(cue === "finished" ? [80, 60, 80] : 60);
  } catch {
    // Ignore.
  }

  const ac = audioContext();
  if (!ac || ac.state !== "running") return;

  try {
    const notes = CUES[cue];
    const noteMs = 130;
    notes.forEach((freq, i) => {
      const startAt = ac.currentTime + (i * noteMs) / 1000;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // A short attack/decay envelope — a raw gate on a sine is an audible
      // click at both ends.
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.18, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + noteMs / 1000);
      osc.connect(gain).connect(ac.destination);
      osc.start(startAt);
      osc.stop(startAt + noteMs / 1000 + 0.02);
    });
  } catch {
    // Ignore — see above.
  }
}
