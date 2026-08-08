export function nowTs(): number {
  return Date.now();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Shared base: clamp to whole non-negative seconds. Both the live timer
// (HH:MM:SS) and the magnitude formatter ("1h 23m") derive from this.
function totalSeconds(ms: number): number {
  return Math.max(0, Math.floor(ms / 1000));
}

export function formatElapsed(ms: number): string {
  const total = totalSeconds(ms);
  return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
}

export function formatDuration(ms: number): string {
  const total = totalSeconds(ms);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// --- Duration stepper (timed clock-in) -------------------------------------
//
// Bounds for a session's work target, in minutes. The ceiling matches
// SESSION_CAP_MS: the 10-hour cap would end a longer session anyway, so
// offering more would be offering something we can't honour.
export const MIN_DURATION_MINUTES = 10;
export const MAX_DURATION_MINUTES = 600;
const STEP_MINUTES = 10;

export function clampDurationMinutes(min: number): number {
  if (!Number.isFinite(min)) return MIN_DURATION_MINUTES;
  return Math.min(
    MAX_DURATION_MINUTES,
    Math.max(MIN_DURATION_MINUTES, Math.round(min))
  );
}

// The next/previous multiple of ten, NOT +10 and -10.
//
// Typing an off-step value is honoured exactly — type 47 and you get 47 — but
// stepping from it lands on round numbers (47 → 50, or 47 → 40) instead of
// stranding you on 57 and 67 forever with no way back except retyping.
export function stepDurationUp(min: number): number {
  return clampDurationMinutes(
    Math.floor(min / STEP_MINUTES) * STEP_MINUTES + STEP_MINUTES
  );
}

export function stepDurationDown(min: number): number {
  return clampDurationMinutes(
    Math.ceil(min / STEP_MINUTES) * STEP_MINUTES - STEP_MINUTES
  );
}

// Split a total into the two fields the duration editor shows.
export function splitHoursMinutes(total: number): { h: number; m: number } {
  const safe = Math.max(0, Math.round(total));
  return { h: Math.floor(safe / 60), m: safe % 60 };
}

// Combine the two typed fields back into a total, or null when there's nothing
// usable to combine (both blank/garbage) so the caller can keep the old value
// rather than wipe the target.
//
// A blank field counts as zero, which is what makes "0 hours" mean just minutes
// and "0 minutes" mean just hours without either needing to be filled in.
//
// Minutes are NOT capped at 59: typing 90 minutes means 1h 30m. Rejecting it
// would be treating a shorthand as a mistake, and the total gets clamped to the
// session bounds anyway.
export function totalMinutesFrom(
  hours: string,
  minutes: string
): number | null {
  const h = Number.parseInt(hours, 10);
  const m = Number.parseInt(minutes, 10);
  const hOk = Number.isFinite(h) && h >= 0;
  const mOk = Number.isFinite(m) && m >= 0;
  if (!hOk && !mOk) return null;
  return clampDurationMinutes((hOk ? h : 0) * 60 + (mOk ? m : 0));
}
