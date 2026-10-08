// The client event queue, as a PURE reducer over a plain state object. The
// browser pieces — localStorage, timers, fetch, the Capacitor App events — live
// in lib/telemetry/client.ts and only ever call these. That split is what makes
// the batching rules testable without a browser: when a flush is due, how big
// a batch may be, what happens to a batch the server refused, and how the
// queue survives a round trip through storage.

import type { CleanProps } from "@/lib/telemetry/events";

export type QueuedEvent = {
  // Client-minted, so a batch the server received but the suspended webview
  // never saw acknowledged is a no-op when it is sent again: app_events has a
  // unique index on (device_id, event_id).
  event_id: string;
  name: string;
  props: CleanProps;
  // The client clock, ISO. The server clamps it and stamps received_at itself.
  occurred_at: string;
  app_session_id: string | null;
  attempts: number;
};

export type QueueState = { events: QueuedEvent[] };

export const EMPTY_QUEUE: QueueState = { events: [] };

// Flush every ~15s, or as soon as 20 events are waiting, or on the way to the
// background (the spec's three triggers).
export const FLUSH_INTERVAL_MS = 15_000;
export const FLUSH_AT_EVENTS = 20;
// A batch is capped at 25 events / 16 KB. The byte cap matters more than it
// looks: a `keepalive` fetch — the only kind that survives backgrounding — is
// limited to 64 KB in flight PER ORIGIN, and exceeding it throws synchronously.
export const MAX_BATCH_EVENTS = 25;
export const MAX_BATCH_BYTES = 16 * 1024;
// A device that cannot reach the server for a long time keeps the newest
// events, not the oldest: beyond this the queue drops from the front.
export const MAX_QUEUE_EVENTS = 500;
// A batch the server could not be reached for is retried this many times,
// then dropped silently. A batch the server REFUSED (4xx) is dropped at once —
// it would be refused again.
export const MAX_ATTEMPTS = 3;

export function enqueue(state: QueueState, event: QueuedEvent): QueueState {
  const events = [...state.events, event];
  return {
    events:
      events.length > MAX_QUEUE_EVENTS
        ? events.slice(events.length - MAX_QUEUE_EVENTS)
        : events,
  };
}

export function shouldFlush(
  state: QueueState,
  opts: { msSinceLastFlush: number; background: boolean }
): boolean {
  if (state.events.length === 0) return false;
  if (opts.background) return true;
  if (state.events.length >= FLUSH_AT_EVENTS) return true;
  return opts.msSinceLastFlush >= FLUSH_INTERVAL_MS;
}

// The oldest events that fit under both caps. Always at least one, so a single
// oversized event (which the validator makes impossible anyway) cannot wedge
// the queue forever.
export function nextBatch(state: QueueState): QueuedEvent[] {
  const batch: QueuedEvent[] = [];
  let bytes = 0;
  for (const e of state.events) {
    const size = JSON.stringify(e).length;
    if (batch.length > 0 && (batch.length >= MAX_BATCH_EVENTS || bytes + size > MAX_BATCH_BYTES)) {
      break;
    }
    batch.push(e);
    bytes += size;
  }
  return batch;
}

export function markSent(state: QueueState, ids: readonly string[]): QueueState {
  const sent = new Set(ids);
  return { events: state.events.filter((e) => !sent.has(e.event_id)) };
}

// `retryable` is "the server could not be reached or errored" (network, 5xx);
// a 4xx is a batch the server will never take, so it goes at once.
export function markFailed(
  state: QueueState,
  ids: readonly string[],
  retryable: boolean
): QueueState {
  const failed = new Set(ids);
  const events: QueuedEvent[] = [];
  for (const e of state.events) {
    if (!failed.has(e.event_id)) {
      events.push(e);
      continue;
    }
    if (!retryable) continue;
    const attempts = e.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) continue;
    events.push({ ...e, attempts });
  }
  return { events };
}

export function serializeQueue(state: QueueState): string {
  return JSON.stringify(state.events);
}

// Anything that is not exactly the shape this module writes is treated as
// empty — a corrupted or hand-edited value must never throw on app start, and
// an unknown shape is not worth sending.
export function parseQueue(raw: string | null): QueueState {
  if (!raw) return EMPTY_QUEUE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_QUEUE;
    const events: QueuedEvent[] = [];
    for (const item of parsed) {
      if (!isQueuedEvent(item)) return EMPTY_QUEUE;
      events.push(item);
    }
    return { events: events.slice(-MAX_QUEUE_EVENTS) };
  } catch {
    return EMPTY_QUEUE;
  }
}

function isQueuedEvent(v: unknown): v is QueuedEvent {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.event_id === "string" &&
    typeof o.name === "string" &&
    typeof o.props === "object" &&
    o.props !== null &&
    !Array.isArray(o.props) &&
    typeof o.occurred_at === "string" &&
    (o.app_session_id === null || typeof o.app_session_id === "string") &&
    typeof o.attempts === "number"
  );
}
