export function dayIndexMonFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - dayIndexMonFirst(out));
  return out;
}

export function endOfWeek(d: Date): Date {
  const out = startOfWeek(d);
  out.setDate(out.getDate() + 6);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

// Calendar-month / calendar-year boundaries, defined in local time exactly
// like startOfWeek/endOfWeek above (inclusive end at 23:59:59.999). Using the
// same convention is what lets month/year rollups reconcile with the weekly
// numbers: every session is attributed by a single instant (its `end`), so it
// lands in exactly one week AND exactly one month AND exactly one year — never
// double-counted, never dropped.
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  // Day 0 of the next month is the last day of this month.
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function formatRange(start: Date, end: Date): string {
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalDate(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Returns YYYY-MM-DD (ISO-style) for the current moment in the given IANA
// timezone. Used by the habits server actions to verify the client's
// claimed "today" matches the user's stored timezone.
export function todayInTimeZone(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Returns {startDate, endDate} as YYYY-MM-DD for the Mon–Sun week containing
// "today" in the given IANA timezone. UTC arithmetic on the parsed date
// avoids any local-tz interpretation reshifting the day math.
export function weekRangeInTimeZone(tz: string): {
  startDate: string;
  endDate: string;
} {
  const today = todayInTimeZone(tz);
  const [y, m, d] = today.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  const dow = (anchor.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const fmt = (x: Date) =>
    `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

// Offset of `tz` from UTC at the instant `utcMs`, in ms (positive east of
// UTC). Derived by re-reading the instant's wall-clock time in `tz` via Intl.
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// UTC instant (ms) of local midnight starting the given YYYY-MM-DD in `tz`.
// Second offset pass handles DST transitions landing near midnight.
export function zonedDayStartMs(dateStr: string, tz: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d);
  const ts = wallAsUtc - tzOffsetMs(wallAsUtc, tz);
  return wallAsUtc - tzOffsetMs(ts, tz);
}

// Monday of the week containing the given YYYY-MM-DD, as YYYY-MM-DD.
// UTC arithmetic so the local tz never reshifts the day math.
export function mondayOfDateISO(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7));
  return `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-${String(anchor.getUTCDate()).padStart(2, "0")}`;
}

// Adds `n` days to a YYYY-MM-DD string, returning a new YYYY-MM-DD string.
// UTC-based to avoid local-tz day shifts.
export function addDaysISO(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// Short, minute-granularity "time ago" for feed timestamps: "just now",
// "12m ago", "3h ago". Past ~a day it defers to formatRelativeDay (Yesterday /
// weekday / "Mon, Jan 5"). `fromMs`/`nowMs` are epoch ms. Future times (clock
// skew) collapse to "just now".
export function formatRelativeTime(fromMs: number, nowMs: number): string {
  const diffMs = nowMs - fromMs;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  return formatRelativeDay(new Date(fromMs), new Date(nowMs));
}

export function formatRelativeDay(d: Date, now: Date): string {
  const dayKey = formatLocalDate(d);
  if (dayKey === formatLocalDate(now)) return "Today";
  if (dayKey === formatLocalDate(addDays(now, -1))) return "Yesterday";
  const diffMs = now.getTime() - d.getTime();
  if (diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
