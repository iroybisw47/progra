import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project. A stray lockfile at
  // C:\Users\iroyb\package-lock.json makes Next infer the wrong workspace
  // root, which was wedging the dev server; this nails it down.
  turbopack: { root: import.meta.dirname },
  experimental: {
    // Client Cache for dynamic pages: tab switches within 30s reuse the cached
    // RSC payload instead of re-running the full server pipeline. Safe because
    // every mutation revalidates its surfaces (lib/revalidate.ts) — the user's
    // own changes still show instantly; friends' activity lags ≤30s, and the
    // feed's poll/refocus refresh still forces freshness there.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
