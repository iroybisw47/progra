import type { NextConfig } from "next";

// sharp's native pieces, force-included in the trace of every route that
// processes an image.
//
// The file tracer follows JS requires. `@img/sharp-{platform}/…/*.node` is
// require()d so it lands in the bundle, but the addon then dlopen()s
// `@img/sharp-libvips-{platform}/lib/libvips-cpp.so.*` — a path no JS ever
// mentions — so that 17MB library was silently left out of every deployed
// function. First use threw `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot
// open shared object file`, and because Next bundles all of a route's server
// actions into ONE module, that killed every action on the route, not just the
// upload (see CHANGELOG 2026-08-19).
//
// Scoped to the five routes that mount AvatarPicker / SessionPhotoStep rather
// than "/**": it's ~18MB per function. A route that starts taking photo
// uploads must be added here — the symptom would be an upload that fails with
// "Photo uploads are temporarily unavailable" (lib/images/sharp.ts) while the
// rest of the route keeps working.
const SHARP_NATIVE = ["node_modules/@img/**/*", "node_modules/sharp/**/*"];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/onboarding": SHARP_NATIVE,
    "/settings": SHARP_NATIVE,
    "/clock": SHARP_NATIVE,
    "/clock/live": SHARP_NATIVE,
    "/clock/finish": SHARP_NATIVE,
  },
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
