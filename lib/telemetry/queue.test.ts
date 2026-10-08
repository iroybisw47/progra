import { describe, expect, it } from "vitest";

import {
  EMPTY_QUEUE,
  FLUSH_AT_EVENTS,
  FLUSH_INTERVAL_MS,
  MAX_ATTEMPTS,
  MAX_BATCH_BYTES,
  MAX_BATCH_EVENTS,
  MAX_QUEUE_EVENTS,
  enqueue,
  markFailed,
  markSent,
  nextBatch,
  parseQueue,
  serializeQueue,
  shouldFlush,
  type QueuedEvent,
  type QueueState,
} from "@/lib/telemetry/queue";

function ev(n: number, extra: Partial<QueuedEvent> = {}): QueuedEvent {
  return {
    event_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: "feed_viewed",
    props: {},
    occurred_at: "2026-10-07T12:00:00.000Z",
    app_session_id: null,
    attempts: 0,
    ...extra,
  };
}

function fill(n: number): QueueState {
  let s = EMPTY_QUEUE;
  for (let i = 0; i < n; i++) s = enqueue(s, ev(i));
  return s;
}

describe("shouldFlush — the three triggers", () => {
  it("never flushes an empty queue", () => {
    expect(shouldFlush(EMPTY_QUEUE, { msSinceLastFlush: 1e9, background: true })).toBe(false);
  });

  it("flushes on the way to the background, however little is waiting", () => {
    expect(shouldFlush(fill(1), { msSinceLastFlush: 0, background: true })).toBe(true);
  });

  it("flushes once the batch reaches the threshold", () => {
    expect(shouldFlush(fill(FLUSH_AT_EVENTS - 1), { msSinceLastFlush: 0, background: false })).toBe(
      false
    );
    expect(shouldFlush(fill(FLUSH_AT_EVENTS), { msSinceLastFlush: 0, background: false })).toBe(
      true
    );
  });

  it("flushes on the interval otherwise", () => {
    expect(
      shouldFlush(fill(1), { msSinceLastFlush: FLUSH_INTERVAL_MS - 1, background: false })
    ).toBe(false);
    expect(shouldFlush(fill(1), { msSinceLastFlush: FLUSH_INTERVAL_MS, background: false })).toBe(
      true
    );
  });
});

describe("nextBatch — the caps", () => {
  it("takes the oldest events first, up to the event cap", () => {
    const batch = nextBatch(fill(MAX_BATCH_EVENTS + 10));
    expect(batch).toHaveLength(MAX_BATCH_EVENTS);
    expect(batch[0].event_id).toBe(ev(0).event_id);
  });

  it("stops under the byte cap, which is what keeps a keepalive send legal", () => {
    // Pad each event to ~2 KB via a long enum-looking value; the validator
    // would never let this through, but the queue must still bound it.
    const big = (n: number) => ev(n, { props: { pad: "x".repeat(2000) } });
    let s = EMPTY_QUEUE;
    for (let i = 0; i < 20; i++) s = enqueue(s, big(i));
    const batch = nextBatch(s);
    expect(JSON.stringify(batch).length).toBeLessThanOrEqual(MAX_BATCH_BYTES + 2);
    expect(batch.length).toBeLessThan(20);
    expect(batch.length).toBeGreaterThan(0);
  });

  it("always returns at least one event, so nothing can wedge the queue", () => {
    const s = enqueue(EMPTY_QUEUE, ev(0, { props: { pad: "x".repeat(MAX_BATCH_BYTES * 2) } }));
    expect(nextBatch(s)).toHaveLength(1);
  });
});

describe("markSent / markFailed — delivery outcomes", () => {
  it("removes acknowledged events and keeps the rest in order", () => {
    const s = markSent(fill(3), [ev(1).event_id]);
    expect(s.events.map((e) => e.event_id)).toEqual([ev(0).event_id, ev(2).event_id]);
  });

  it("keeps event ids stable across a retry, so a resend is idempotent server-side", () => {
    const s = markFailed(fill(1), [ev(0).event_id], true);
    expect(s.events[0].event_id).toBe(ev(0).event_id);
    expect(s.events[0].attempts).toBe(1);
  });

  it("drops a batch after MAX_ATTEMPTS unreachable attempts", () => {
    let s = fill(1);
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = markFailed(s, [ev(0).event_id], true);
    expect(s.events).toHaveLength(0);
  });

  it("drops a REFUSED batch at once — the server would refuse it again", () => {
    const s = markFailed(fill(2), [ev(0).event_id], false);
    expect(s.events.map((e) => e.event_id)).toEqual([ev(1).event_id]);
  });
});

describe("enqueue — the ceiling", () => {
  it("keeps the newest events when the queue overflows", () => {
    const s = fill(MAX_QUEUE_EVENTS + 5);
    expect(s.events).toHaveLength(MAX_QUEUE_EVENTS);
    expect(s.events[0].event_id).toBe(ev(5).event_id);
  });
});

describe("serialize / parse — the storage round trip", () => {
  it("round-trips exactly", () => {
    const s = fill(3);
    expect(parseQueue(serializeQueue(s))).toEqual(s);
  });

  it("treats a missing, corrupt or foreign value as empty rather than throwing", () => {
    expect(parseQueue(null)).toEqual(EMPTY_QUEUE);
    expect(parseQueue("")).toEqual(EMPTY_QUEUE);
    expect(parseQueue("{not json")).toEqual(EMPTY_QUEUE);
    expect(parseQueue('{"events":[]}')).toEqual(EMPTY_QUEUE);
    expect(parseQueue('[{"event_id":1}]')).toEqual(EMPTY_QUEUE);
  });
});
