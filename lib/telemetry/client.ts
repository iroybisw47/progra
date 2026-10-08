// The browser half of the internal analytics pipeline: `track()` validates,
// queues and batches events to POST /api/analytics/events. Everything that can
// be a pure function lives in lib/telemetry/queue.ts and events.ts; this file
// owns only the browser state — storage, the timer, fetch, and the module-level
// counters the root-layout lifecycle leaf drives.
//
// Three promises every caller can rely on:
//   1. It never throws and never blocks the UI. Storage, fetch and JSON errors
//      are swallowed; a batch the server cannot be reached for is retried a few
//      times and then dropped silently.
//   2. With ANALYTICS off it makes ZERO network calls — not even a dropped one.
//   3. Nothing free-text can get in: validateEvent() refuses it before the
//      event exists (lib/telemetry/events.ts), and in development says so.
//
// Identity is NOT sent. The server derives user_id from the access-token
// cookie; the body carries only a device id (a random UUID minted on first
// launch and kept in localStorage) and an app-session id. Events recorded
// before sign-in are claimed by link_device_events on the next signed-in open.

import { ANALYTICS } from "@/lib/flags";
import { appPlugin } from "@/lib/native-plugins";
import {
  validateEvent,
  type AnalyticsEvent,
  type TrackProps,
} from "@/lib/telemetry/events";
import {
  FLUSH_INTERVAL_MS,
  enqueue,
  markFailed,
  markSent,
  nextBatch,
  parseQueue,
  serializeQueue,
  shouldFlush,
  type QueueState,
} from "@/lib/telemetry/queue";
import { isUuid } from "@/lib/validate";

export const INGEST_PATH = "/api/analytics/events";

const DEVICE_KEY = "progra.telemetry.device";
const QUEUE_KEY = "progra.telemetry.queue";
// Coming back after this long in the background starts a new app session.
const APP_SESSION_GAP_MS = 30 * 60_000;
// A resume this soon after a notification tap is the tap's open.
const TAP_WINDOW_MS = 3_000;

let queue: QueueState | null = null; // null = not yet loaded from storage
let deviceId: string | null = null;
let appSessionId: string | null = null;
let foregroundedAt = 0;
let backgroundedAt: number | null = null;
let lastTapAt = 0;
let lastFlushAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
let appVersion: string | null = null;
let appVersionRequested = false;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Private mode, blocked storage. Everything degrades to in-memory.
    return null;
  }
}

function newId(): string {
  const c = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  // Older WKWebViews lack randomUUID; getRandomValues is universal.
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Minted once per install and kept for the life of the site data. Null during
// SSR, which is the only time there is no device.
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  if (deviceId) return deviceId;
  const s = storage();
  let stored: string | null = null;
  try {
    stored = s?.getItem(DEVICE_KEY) ?? null;
  } catch {
    stored = null;
  }
  if (stored && isUuid(stored)) {
    deviceId = stored.toLowerCase();
    return deviceId;
  }
  deviceId = newId();
  try {
    s?.setItem(DEVICE_KEY, deviceId);
  } catch {
    // In-memory only for this page life.
  }
  return deviceId;
}

// One id per "sitting": a cold start, or a return after 30 minutes away.
export function getAppSessionId(): string {
  if (!appSessionId) appSessionId = newId();
  return appSessionId;
}

// Running inside the Capacitor shell. Off the plugin global, not
// @capacitor/core, so this module adds nothing to a server bundle that happens
// to import lib/analytics.ts.
function inNativeShell(): boolean {
  return appPlugin() !== null;
}

function requestAppVersion(): void {
  if (appVersionRequested) return;
  appVersionRequested = true;
  const app = appPlugin();
  if (!app) return;
  void app
    .getInfo()
    .then((info) => {
      appVersion = `${info.version} (${info.build})`.slice(0, 32);
    })
    .catch(() => {
      // No version is fine; the server still stamps its own build.
    });
}

function load(): QueueState {
  if (queue) return queue;
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(QUEUE_KEY) ?? null;
  } catch {
    raw = null;
  }
  queue = parseQueue(raw);
  return queue;
}

function persist(): void {
  if (!queue) return;
  try {
    const s = storage();
    if (!s) return;
    if (queue.events.length === 0) s.removeItem(QUEUE_KEY);
    else s.setItem(QUEUE_KEY, serializeQueue(queue));
  } catch {
    // Quota or private mode: the queue lives in memory until the next flush.
  }
}

export function track(name: AnalyticsEvent, props?: TrackProps): void {
  if (!ANALYTICS || typeof window === "undefined") return;
  const checked = validateEvent(name, props);
  if (!checked.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[telemetry] dropped ${String(name)}: ${checked.reason}`);
    }
    return;
  }
  queue = enqueue(load(), {
    event_id: newId(),
    name: checked.name,
    props: checked.props,
    occurred_at: new Date().toISOString(),
    app_session_id: getAppSessionId(),
    attempts: 0,
  });
  persist();
  requestAppVersion();
  if (
    shouldFlush(queue, {
      msSinceLastFlush: Date.now() - lastFlushAt,
      background: false,
    })
  ) {
    void send(false);
  } else {
    arm();
  }
}

// Send whatever is waiting. `background` uses a keepalive request, the only
// kind that survives the page being suspended.
export function flush(opts: { background?: boolean } = {}): void {
  void send(opts.background === true);
}

function arm(): void {
  if (timer !== null) return;
  const wait = Math.max(1_000, FLUSH_INTERVAL_MS - (Date.now() - lastFlushAt));
  timer = setTimeout(() => {
    timer = null;
    void send(false);
  }, wait);
}

async function send(background: boolean): Promise<void> {
  if (typeof window === "undefined" || inflight) return;
  const batch = nextBatch(load());
  if (batch.length === 0) return;
  const device = getDeviceId();
  if (!device) return;

  inflight = true;
  lastFlushAt = Date.now();
  const ids = batch.map((e) => e.event_id);
  const body = JSON.stringify({
    device_id: device,
    platform: inNativeShell() ? "ios" : "web",
    app_version: appVersion,
    events: batch.map((e) => ({
      event_id: e.event_id,
      name: e.name,
      props: e.props,
      occurred_at: e.occurred_at,
      app_session_id: e.app_session_id,
    })),
  });

  let ok = false;
  let retryable = true;
  try {
    const res = await fetch(INGEST_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: background,
      credentials: "same-origin",
    });
    ok = res.ok;
    // A 4xx is a batch the server will never take; anything else may be
    // transient.
    retryable = res.status >= 500;
  } catch {
    ok = false;
    retryable = true;
  }
  queue = ok ? markSent(load(), ids) : markFailed(load(), ids, retryable);
  inflight = false;
  persist();

  if (queue.events.length === 0) return;
  // More than one batch was waiting: drain now after a success, back off
  // otherwise.
  if (ok && !background) void send(false);
  else arm();
}

// --- lifecycle hooks, driven by components/analytics-lifecycle.tsx -----------

export type ForegroundInfo = {
  cold: boolean;
  source: "launch" | "foreground" | "notification_tap";
};

// Call on every return to the foreground, including the first paint. Returns
// null for a resume that follows no background (some shells fire one at
// launch), so an open is never counted twice.
export function noteForeground(): ForegroundInfo | null {
  const now = Date.now();
  const cold = foregroundedAt === 0;
  if (!cold && backgroundedAt === null) return null;
  if (backgroundedAt !== null && now - backgroundedAt > APP_SESSION_GAP_MS) {
    appSessionId = newId();
  }
  backgroundedAt = null;
  foregroundedAt = now;
  const source =
    now - lastTapAt <= TAP_WINDOW_MS
      ? "notification_tap"
      : cold
        ? "launch"
        : "foreground";
  return { cold, source };
}

// Call on the way to the background. Returns seconds since the foreground.
export function noteBackground(): number {
  const now = Date.now();
  backgroundedAt = now;
  return Math.max(0, Math.round((now - (foregroundedAt || now)) / 1_000));
}

// The tap router calls this before routing, so the open that follows is
// attributed to the notification.
export function noteNotificationTap(): void {
  lastTapAt = Date.now();
}
