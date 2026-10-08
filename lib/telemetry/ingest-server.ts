import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { ANALYTICS } from "@/lib/flags";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEVICE_REQUESTS_PER_MINUTE,
  MAX_BODY_BYTES,
  accessTokenFromCookieHeader,
  createRateLimiter,
  eventsForIdentity,
  isTrustedOrigin,
  parseBatch,
} from "@/lib/telemetry/ingest";
import { isUuid } from "@/lib/validate";

// The server half of POST /api/analytics/events. The route itself is a thin
// shell that always answers 204; this does the work and swallows every
// failure, because analytics must never be observable as an error by the app.
//
// IDENTITY. The user id is derived from the access-token cookie, verified
// LOCALLY against the project's JWKS with auth.getClaims(token) — the one
// Supabase call that neither reads nor refreshes a session. That is the whole
// reason this route is excluded from proxy.ts: a refresh here would rotate the
// refresh token on a fire-and-forget request. An expired token is treated as
// "no user" and the batch is stored by device id; link_device_events claims it
// on the next signed-in open. Nothing in the request BODY is ever treated as
// identity.
//
// SERVICE ROLE. This is exception kind (4) in lib/supabase/admin.ts: identity
// is established above before the admin client touches anything, the only
// write is one revoked definer RPC that accepts no user id from the body, and
// what it writes is append-only telemetry under RLS-on/no-policy tables.

const PRUNE_INTERVAL_MS = 60 * 60_000;

let verifier: SupabaseClient | null = null;
let lastPruneAt = 0;
const limiter = createRateLimiter(DEVICE_REQUESTS_PER_MINUTE);

// Verifies a token against the project's signing keys (fetched once per
// instance and cached inside the client). Expired, malformed or foreign
// tokens all come back null.
async function verifiedUserId(token: string | null): Promise<string | null> {
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  verifier ??= createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { data, error } = await verifier.auth.getClaims(token);
    if (error || !data) return null;
    const sub = data.claims.sub;
    return isUuid(sub) ? sub : null;
  } catch {
    return null;
  }
}

export type IngestOutcome =
  | "off"
  | "untrusted"
  | "too_large"
  | "malformed"
  | "rate_limited"
  | "nothing"
  | "stored"
  | "failed";

export async function ingest(request: Request): Promise<IngestOutcome> {
  if (!ANALYTICS) return "off";
  if (!isTrustedOrigin(request.headers)) return "untrusted";
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return "too_large";
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return "too_large";

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return "malformed";
  }
  const batch = parseBatch(json);
  if (!batch) return "malformed";
  if (!limiter.allow(batch.deviceId, Date.now())) return "rate_limited";

  const token = await accessTokenFromCookieHeader(
    request.headers.get("cookie"),
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  );
  const userId = await verifiedUserId(token);
  const events = eventsForIdentity(batch.events, userId);
  if (events.length === 0) return "nothing";

  const admin = createAdminClient();
  const { error } = await admin.rpc("ingest_app_events", {
    p_device: batch.deviceId,
    p_user: userId,
    p_platform: batch.platform,
    p_app_version: batch.appVersion,
    p_build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    p_events: events,
  });
  if (error) {
    console.error("[analytics] ingest_app_events failed (SQL run?):", error.message);
    return "failed";
  }

  // Retention, lazily: the first request each hour on this instance sweeps raw
  // events older than 180 days. The house rule is one scheduled job, and this
  // does not need to be the second — a sweep that is late by an hour or a day
  // changes nothing.
  const now = Date.now();
  if (now - lastPruneAt > PRUNE_INTERVAL_MS) {
    lastPruneAt = now;
    const { error: pruneError } = await admin.rpc("prune_app_events");
    if (pruneError) console.error("[analytics] prune failed:", pruneError.message);
  }
  return "stored";
}
