import { stringToBase64URL } from "@supabase/ssr";
import { describe, expect, it } from "vitest";

import {
  accessTokenFromCookieHeader,
  createRateLimiter,
  eventsForIdentity,
  isTrustedOrigin,
  parseBatch,
  type IngestEvent,
} from "@/lib/telemetry/ingest";
import { MAX_BATCH_EVENTS } from "@/lib/telemetry/queue";

const DEVICE = "7c1f3b2a-0d4e-4f5a-8b6c-9d0e1f2a3b4c";
const UUID = "0b9a4c2e-6f1d-4a3b-9c8e-1f2a3b4c5d6e";
const AT = "2026-10-07T12:00:00.000Z";

function event(n: number, over: Record<string, unknown> = {}) {
  return {
    event_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: "feed_viewed",
    props: {},
    occurred_at: AT,
    app_session_id: null,
    ...over,
  };
}

function body(events: unknown[], over: Record<string, unknown> = {}) {
  return { device_id: DEVICE, platform: "web", app_version: null, events, ...over };
}

describe("parseBatch — shape", () => {
  it("accepts a well-formed batch and lowercases ids", () => {
    const b = parseBatch(body([event(1, { app_session_id: UUID.toUpperCase() })], {
      device_id: DEVICE.toUpperCase(),
      platform: "ios",
      app_version: "1.02 (2)",
    }));
    expect(b).toEqual({
      deviceId: DEVICE,
      platform: "ios",
      appVersion: "1.02 (2)",
      events: [
        {
          event_id: event(1).event_id,
          name: "feed_viewed",
          props: {},
          occurred_at: AT,
          app_session_id: UUID,
        },
      ],
    });
  });

  it("rejects a batch that is not an object, has no device, or a bad platform", () => {
    expect(parseBatch(null)).toBeNull();
    expect(parseBatch([])).toBeNull();
    expect(parseBatch(body([], { device_id: "my-phone" }))).toBeNull();
    expect(parseBatch(body([], { platform: "android" }))).toBeNull();
    expect(parseBatch(body([], { events: "x" }))).toBeNull();
  });

  it("rejects more events than a client would ever send", () => {
    const many = Array.from({ length: MAX_BATCH_EVENTS + 1 }, (_, i) => event(i));
    expect(parseBatch(body(many))).toBeNull();
    expect(parseBatch(body(many.slice(1)))?.events).toHaveLength(MAX_BATCH_EVENTS);
  });

  it("drops an invalid app_version rather than the batch", () => {
    expect(parseBatch(body([], { app_version: "<script>" }))?.appVersion).toBeNull();
    expect(parseBatch(body([], { app_version: "x".repeat(40) }))?.appVersion).toBeNull();
  });
});

describe("parseBatch — events are judged one by one", () => {
  it("drops an event with an unknown name, an off-schema key or a free-text value, keeps the rest", () => {
    const b = parseBatch(
      body([
        event(1),
        event(2, { name: "pageview" }),
        event(3, { name: "goal_created", props: { title: "Thesis" } }),
        event(4, { name: "goal_created", props: { goal_id: "Thesis" } }),
        event(5, { name: "goal_created", props: { goal_id: UUID } }),
      ])
    );
    expect(b?.events.map((e) => e.event_id)).toEqual([event(1).event_id, event(5).event_id]);
  });

  it("drops an event with a bad id, timestamp or session id", () => {
    const b = parseBatch(
      body([
        event(1, { event_id: "1" }),
        event(2, { occurred_at: "yesterday" }),
        event(3, { occurred_at: "x".repeat(50) }),
        event(4, { app_session_id: "sitting-1" }),
        event(5),
      ])
    );
    expect(b?.events.map((e) => e.event_id)).toEqual([event(5).event_id]);
  });

  it("collapses a duplicate event id inside one batch to the first", () => {
    const b = parseBatch(body([event(1), event(1, { name: "clock_in_screen_opened" })]));
    expect(b?.events).toHaveLength(1);
    expect(b?.events[0].name).toBe("feed_viewed");
  });
});

describe("isTrustedOrigin", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

  it("accepts an Origin that matches the request host", () => {
    expect(isTrustedOrigin(h({ host: "progra.world", origin: "https://progra.world" }))).toBe(true);
    expect(isTrustedOrigin(h({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(
      true
    );
  });

  it("rejects a foreign or malformed Origin", () => {
    expect(isTrustedOrigin(h({ host: "progra.world", origin: "https://evil.example" }))).toBe(false);
    expect(isTrustedOrigin(h({ host: "progra.world", origin: "not a url" }))).toBe(false);
    expect(isTrustedOrigin(h({ origin: "https://progra.world" }))).toBe(false);
  });

  it("falls back to Sec-Fetch-Site, and rejects a request with neither", () => {
    expect(isTrustedOrigin(h({ host: "progra.world", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isTrustedOrigin(h({ host: "progra.world", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isTrustedOrigin(h({ host: "progra.world" }))).toBe(false);
  });
});

describe("eventsForIdentity", () => {
  const evs = parseBatch(
    body([event(1), event(2, { name: "landing_viewed" }), event(3, { name: "sign_in_started" })])
  )!.events as IngestEvent[];

  it("keeps everything for a verified user", () => {
    expect(eventsForIdentity(evs, UUID)).toHaveLength(3);
  });

  it("keeps only the landing-page events without one", () => {
    expect(eventsForIdentity(evs, null).map((e) => e.name)).toEqual([
      "landing_viewed",
      "sign_in_started",
    ]);
  });
});

describe("accessTokenFromCookieHeader", () => {
  const URL_ = "https://abcdefghijkl.supabase.co";
  const KEY = "sb-abcdefghijkl-auth-token";
  const session = JSON.stringify({ access_token: "eyJ.token.sig", refresh_token: "r" });

  it("reads a base64-encoded session", async () => {
    const cookie = `${KEY}=base64-${stringToBase64URL(session)}; other=1`;
    expect(await accessTokenFromCookieHeader(cookie, URL_)).toBe("eyJ.token.sig");
  });

  it("reassembles a chunked cookie", async () => {
    const encoded = `base64-${stringToBase64URL(session)}`;
    const mid = Math.floor(encoded.length / 2);
    const cookie = `${KEY}.0=${encoded.slice(0, mid)}; ${KEY}.1=${encoded.slice(mid)}`;
    expect(await accessTokenFromCookieHeader(cookie, URL_)).toBe("eyJ.token.sig");
  });

  it("reads the older plain-JSON encoding", async () => {
    expect(
      await accessTokenFromCookieHeader(`${KEY}=${encodeURIComponent(session)}`, URL_)
    ).toBe("eyJ.token.sig");
  });

  it("is null for a missing, foreign or corrupt cookie", async () => {
    expect(await accessTokenFromCookieHeader(null, URL_)).toBeNull();
    expect(await accessTokenFromCookieHeader("theme=dark", URL_)).toBeNull();
    expect(await accessTokenFromCookieHeader(`${KEY}=base64-!!!`, URL_)).toBeNull();
    expect(await accessTokenFromCookieHeader(`${KEY}={"nope":1}`, URL_)).toBeNull();
    expect(await accessTokenFromCookieHeader(`${KEY}=x`, "")).toBeNull();
  });
});

describe("createRateLimiter", () => {
  it("allows the limit within a minute, then refuses, then recovers", () => {
    const rl = createRateLimiter(3);
    expect(rl.allow("d", 0)).toBe(true);
    expect(rl.allow("d", 1_000)).toBe(true);
    expect(rl.allow("d", 2_000)).toBe(true);
    expect(rl.allow("d", 3_000)).toBe(false);
    // Another device is unaffected.
    expect(rl.allow("e", 3_000)).toBe(true);
    // The window slides.
    expect(rl.allow("d", 61_000)).toBe(true);
  });
});
