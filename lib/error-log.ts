// A durable record of the last few client-side crashes, in localStorage.
//
// This exists because of how the app's one failure mode actually presents: a
// throw during the `/` → `/onboarding` redirect shows Next's built-in error UI
// for about a second, then Next clears the boundary the moment the router's
// pathname changes — and the document navigation clears the browser console
// with it. The error is real, reproducible and completely unreadable: by the
// time you look, both the screen and the log are gone.
//
// So the boundary writes it down. `readErrors()` is then callable from the
// console long after the fact, which turns a one-second flash into something
// you can actually read.
//
// Deliberately localStorage and not a server call: the thing being diagnosed is
// a crash, and a crash is the worst moment to depend on the network. Every
// access is wrapped — a private window, cleared site data or a browser blocking
// storage must never turn a crash report into a second crash.

const KEY = "progra:client-errors";
const MAX = 5;

export type ClientErrorRecord = {
  at: string;
  pathname: string;
  message: string;
  // Next sets this only for errors thrown on the SERVER. Its absence is itself
  // the signal that a throw was client-side.
  digest?: string;
  stack?: string;
};

export function recordError(error: Error & { digest?: string }): void {
  try {
    const record: ClientErrorRecord = {
      at: new Date().toISOString(),
      pathname: window.location.pathname + window.location.search,
      message: error.message || String(error),
      ...(error.digest ? { digest: error.digest } : {}),
      // Capped: a long React stack can be tens of KB and localStorage is a
      // shared ~5MB budget.
      ...(error.stack ? { stack: error.stack.slice(0, 4000) } : {}),
    };
    const next = [record, ...readErrors()].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable or full. Nothing to do: the console log in the
    // boundary is the fallback.
  }
}

export function readErrors(): ClientErrorRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClientErrorRecord[]) : [];
  } catch {
    return [];
  }
}

export function clearErrors(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unreachable.
  }
}
