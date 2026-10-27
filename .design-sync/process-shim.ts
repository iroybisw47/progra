// next/link + next/navigation internals read process.env.__NEXT_* at module
// scope; in the app the Next compiler defines these, in the standalone design
// bundle nothing does. Shim before any next/* module evaluates (this file is
// entry.ts's first import, so ES module order guarantees it runs first).
//
// The NEXT_PUBLIC_ flags mirror PRODUCTION, where REDESIGN and SOCIAL_ENABLED
// are on (HANDOFF.md). Without them lib/flags reads false and BottomNav renders
// the retired Home/Search/Goals/Habits tabs, BackLink renders nothing, and every
// mockup is built against an app nobody runs. ANALYTICS stays unset on purpose:
// track() is then a no-op instead of POSTing from the design canvas.
const PROD_FLAGS = {
  NODE_ENV: "production",
  NEXT_PUBLIC_REDESIGN: "1",
  NEXT_PUBLIC_SOCIAL_ENABLED: "1",
};
const g = globalThis as { process?: { env: Record<string, string | undefined> } };
if (!g.process) g.process = { env: { ...PROD_FLAGS } };
else g.process.env = { ...PROD_FLAGS, ...(g.process.env ?? {}) };
export {};
