// Small shared server-side validators. Hand-rolled (the app uses no schema
// library); DB CHECK constraints + RLS are the real authority — these give
// friendly errors and defense-in-depth.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True for a canonical UUID string. Used before interpolating a caller-supplied
// id into a PostgREST `.or()` filter, where a non-UUID could alter the filter
// expression.
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// Trim and hard-cap a free-text field server-side (clients also cap, but never
// trust the client). Empty → null so callers can store NULL for blanks.
export function capText(v: string | undefined | null, max: number): string | null {
  if (v == null) return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}
