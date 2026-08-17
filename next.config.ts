import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project. A stray lockfile at
  // C:\Users\iroyb\package-lock.json makes Next infer the wrong workspace
  // root, which was wedging the dev server; this nails it down.
  turbopack: { root: import.meta.dirname },
  // Emit `crossorigin="anonymous"` on Next's own script tags. Without it, a
  // failing cross-origin chunk surfaces as an opaque "Script error." with no
  // message or stack; with it, the browser hands us the real error.
  crossOrigin: "anonymous",
  experimental: {
    // Client Cache for dynamic pages: tab switches within 30s reuse the cached
    // RSC payload instead of re-running the full server pipeline. Safe because
    // every mutation revalidates its surfaces (lib/revalidate.ts) — the user's
    // own changes still show instantly; friends' activity lags ≤30s, and the
    // feed's poll/refocus refresh still forces freshness there.
    staleTimes: { dynamic: 30 },
  },
  // PostHog is proxied through our own origin rather than called directly.
  // Ad and tracking blockers block *.i.posthog.com by hostname, which silently
  // drops a real share of web events — and since the iOS shell loads
  // progra.world, a relative /ingest path works identically there.
  //
  // Worth doing BEFORE any history accumulates: switching hosts later splits
  // the same users across two ingestion origins.
  //
  // PostHog requires trailing-slash redirects to be skipped, or the ingest
  // endpoints 308 and events are lost.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Static assets (the JS snippet, session-replay bundles) live on a
      // different host from the ingestion API.
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  // Baseline security headers on every route. Clickjacking protection
  // (X-Frame-Options + frame-ancestors), MIME-sniffing off, tight referrer,
  // and no access to sensitive browser APIs. A full Content-Security-Policy is
  // deliberately NOT set here yet — it needs per-host allowlisting (Supabase,
  // Google, the public avatar/photo hosts, Next's inline styles, react-easy-crop)
  // and a wrong CSP silently breaks the app, so it's a separate follow-up.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
