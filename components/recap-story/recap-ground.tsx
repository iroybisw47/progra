// The weekly review's ground (RECAP_V2): the navy it opens on, full screen,
// over everything. What shows while the story's data loads — the
// /recap/[weekStart] loading state and the in-place Suspense fallback at "/" —
// so the first thing on screen is already the Loading slide's colour.
//
// Deliberately EMPTY. The Loading slide brings its logo in from nothing (a
// scale-in, then the clock face filling); a static logo here would blink out
// and back the moment the slide mounted.
export function RecapGround() {
  return <div aria-hidden className="bg-brand-deep fixed inset-0 z-50" />;
}
