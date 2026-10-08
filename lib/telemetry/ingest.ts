// The pure half of the ingest route: everything that can be checked without a
// database or a network, so it can be tested. The server half
// (lib/telemetry/ingest-server.ts) adds the JWT verification and the RPC call.

import {
  combineChunks,
  parseCookieHeader,
  stringFromBase64URL,
} from "@supabase/ssr";

import {
  isSignedOutEvent,
  validateEvent,
  type AnalyticsEvent,
  type CleanProps,
} from "@/lib/telemetry/events";
import { MAX_BATCH_EVENTS } from "@/lib/telemetry/queue";
import { isUuid } from "@/lib/validate";

// The client caps a batch at 16 KB; double that is generous slack for
// encoding differences and still far below anything worth parsing.
export const MAX_BODY_BYTES = 32 * 1024;
// Requests per device per minute. A healthy client sends one every 15 s, or
// sooner only when 20 events pile up; a dozen a minute is well clear of that
// and well short of a flood. Per instance only — the RPC holds the hard caps.
export const DEVICE_REQUESTS_PER_MINUTE = 12;

const PLATFORMS = ["ios", "web"] as const;
const APP_VERSION_RE = /^[0-9A-Za-z.()+\- ]{1,32}$/;
const MAX_TIMESTAMP_LEN = 40;

export type IngestEvent = {
  event_id: string;
  name: AnalyticsEvent;
  props: CleanProps;
  occurred_at: string;
  app_session_id: string | null;
};

export type IngestBatch = {
  deviceId: string;
  platform: (typeof PLATFORMS)[number];
  appVersion: string | null;
  events: IngestEvent[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Null for a batch whose SHAPE is wrong (no device, not an array, too many).
// Inside a well-shaped batch, an event that fails validation is dropped on its
// own: a stale tab holding an older bundle must not take the good events down
// with it. Duplicate ids inside one batch are collapsed to the first.
export function parseBatch(body: unknown): IngestBatch | null {
  if (!isRecord(body)) return null;
  if (!isUuid(body.device_id)) return null;
  const platform = body.platform;
  if (typeof platform !== "string" || !(PLATFORMS as readonly string[]).includes(platform)) {
    return null;
  }
  const appVersion =
    typeof body.app_version === "string" && APP_VERSION_RE.test(body.app_version)
      ? body.app_version
      : null;
  if (!Array.isArray(body.events) || body.events.length > MAX_BATCH_EVENTS) return null;

  const seen = new Set<string>();
  const events: IngestEvent[] = [];
  for (const raw of body.events) {
    if (!isRecord(raw)) continue;
    if (!isUuid(raw.event_id)) continue;
    const id = raw.event_id.toLowerCase();
    if (seen.has(id)) continue;
    if (
      typeof raw.occurred_at !== "string" ||
      raw.occurred_at.length > MAX_TIMESTAMP_LEN ||
      Number.isNaN(Date.parse(raw.occurred_at))
    ) {
      continue;
    }
    const appSession =
      raw.app_session_id === null || raw.app_session_id === undefined
        ? null
        : isUuid(raw.app_session_id)
          ? raw.app_session_id.toLowerCase()
          : undefined;
    if (appSession === undefined) continue;
    const checked = validateEvent(raw.name, raw.props);
    if (!checked.ok) continue;
    seen.add(id);
    events.push({
      event_id: id,
      name: checked.name,
      props: checked.props,
      occurred_at: raw.occurred_at,
      app_session_id: appSession,
    });
  }
  return {
    deviceId: body.device_id.toLowerCase(),
    platform: platform as IngestBatch["platform"],
    appVersion,
    events,
  };
}

// Same-origin only. The site and the Capacitor shell both load progra.world,
// so a browser fills in either `Origin` (matching the request host) or
// `Sec-Fetch-Site: same-origin`; a request with neither did not come from the
// app. Cheap abuse filter, not a security boundary — the budgets in the RPC
// are what bound a determined client.
export function isTrustedOrigin(headers: Pick<Headers, "get">): boolean {
  const host = headers.get("host");
  const origin = headers.get("origin");
  if (origin) {
    if (!host) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return headers.get("sec-fetch-site") === "same-origin";
}

// Without a verified user, only the landing-page events survive.
export function eventsForIdentity(
  events: IngestEvent[],
  userId: string | null
): IngestEvent[] {
  if (userId) return events;
  return events.filter((e) => isSignedOutEvent(e.name));
}

// The access token out of the @supabase/ssr cookie, WITHOUT a Supabase client:
// the ssr client would refresh an expired session, and this route must never
// do that (see proxy.ts). Chunked (`name.0`, `name.1`, …) and `base64-`
// encoded values are what the browser client writes today; a plain JSON value
// is the older encoding. Anything unparsable is simply "no token".
export async function accessTokenFromCookieHeader(
  cookieHeader: string | null,
  supabaseUrl: string
): Promise<string | null> {
  if (!cookieHeader || !supabaseUrl) return null;
  let key: string;
  try {
    key = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
  const jar = new Map<string, string>();
  for (const c of parseCookieHeader(cookieHeader)) {
    if (typeof c.value === "string") jar.set(c.name, c.value);
  }
  try {
    const combined = await combineChunks(key, (name) => jar.get(name) ?? null);
    if (!combined) return null;
    const json = combined.startsWith("base64-")
      ? stringFromBase64URL(combined.slice("base64-".length))
      : combined;
    const session: unknown = JSON.parse(json);
    return isRecord(session) && typeof session.access_token === "string"
      ? session.access_token
      : null;
  } catch {
    return null;
  }
}

// A per-key sliding-window limiter. Instance-local by construction (serverless
// instances share nothing), which is why the RPC holds the real budgets; this
// just keeps one noisy client from paying for a database call per request.
export function createRateLimiter(limitPerMinute: number) {
  const recent = new Map<string, number[]>();
  const WINDOW_MS = 60_000;
  let lastSweep = 0;
  return {
    allow(key: string, now: number): boolean {
      // Occasionally forget keys that have gone quiet, so the map is bounded.
      if (now - lastSweep > WINDOW_MS) {
        lastSweep = now;
        for (const [k, times] of recent) {
          if (times.length === 0 || now - times[times.length - 1] > WINDOW_MS) recent.delete(k);
        }
      }
      const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
      if (times.length >= limitPerMinute) {
        recent.set(key, times);
        return false;
      }
      times.push(now);
      recent.set(key, times);
      return true;
    },
  };
}
