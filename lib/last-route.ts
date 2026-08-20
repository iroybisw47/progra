// Remembers which screen the user was on before the one they're on now.
//
// Why this exists: a bug report is filed from /settings, but the bug happened
// somewhere else. Reading usePathname() at submit time would stamp every single
// report with /settings — worse than storing nothing, because it looks
// authoritative while being uniformly wrong.
//
// Module-level variables rather than React state on purpose: <RouteMemory />
// writes here during render, so it holds no state, triggers no re-render, and
// can't trip react-hooks/set-state-in-effect (the repo's lint baseline of 10
// must not grow). Nothing reads these during render, so there's no tearing
// concern — getReportRoute() is called from an event handler.
//
// In-memory only, deliberately. A report is filed seconds after the bug, so
// persistence buys nothing and sessionStorage would only add a way to serve
// stale data after a cold start.

let previous: string | null = null;
let current: string | null = null;

// The screen a report is filed FROM, never the screen it's about.
const FILING_SURFACE = "/settings";

export function recordRoute(path: string): void {
  // Re-renders of the same route must not shift the history, or navigating
  // /clock → /settings and then re-rendering would leave previous = /settings.
  if (path === current) return;
  previous = current;
  current = path;
}

// The route to attach to a bug report. On the filing surface itself that's the
// screen before it; anywhere else (a future contextual "report this" entry
// point) the current screen is already the right answer.
export function getReportRoute(): string | null {
  return current === FILING_SURFACE ? previous : current;
}

// Test seam — the module is a singleton, so tests need a way back to a clean
// slate. Not called by app code.
export function resetRouteMemoryForTest(): void {
  previous = null;
  current = null;
}
