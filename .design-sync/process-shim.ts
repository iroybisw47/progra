// next/link + next/navigation internals read process.env.__NEXT_* at module
// scope; in the app the Next compiler defines these, in the standalone design
// bundle nothing does. Shim before any next/* module evaluates (this file is
// entry.ts's first import, so ES module order guarantees it runs first).
const g = globalThis as { process?: { env: Record<string, string | undefined> } };
if (!g.process) g.process = { env: { NODE_ENV: "production" } };
else if (!g.process.env) g.process.env = { NODE_ENV: "production" };
export {};
