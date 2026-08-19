import "server-only";

import { connect } from "node:http2";

import { mintApnsJwt } from "@/lib/push/apns-jwt";

// A hand-rolled APNs HTTP/2 client — deliberately zero dependencies.
//
// APNs' provider API requires HTTP/2 (Node's fetch speaks HTTP/1.1 only) and
// an ES256 provider JWT. Both are a handful of lines on node:http2 and
// node:crypto, which beats carrying a push SDK for one POST.
//
// EVERY export is safe to call with anything: bad env, no network, a dead
// token. Failures come back as values ("error"), never as throws — a push may
// never break the action that triggered it.

export type ApnsResult = "ok" | "gone" | "error";

export type ApnsAlert = {
  title: string;
  body: string;
  // In-app path, delivered as a custom payload key for the tap router.
  url: string;
};

// The APNs topic is the app's bundle id — a constant, not config: it must
// match ios/App/App/capacitor.config.json's appId or every push is rejected
// with TopicDisallowed.
const APNS_TOPIC = "world.progra.app";

// Production host by default (App Store and TestFlight builds register
// production tokens). A dev build signed by Xcode registers SANDBOX tokens,
// which the production host rejects as BadDeviceToken — override with
// APNS_HOST=api.sandbox.push.apple.com to test against a dev device.
function apnsHost(): string {
  return process.env.APNS_HOST || "api.push.apple.com";
}

// Apple wants a token reused for 20–60 minutes (re-minting per push reads as
// abuse; holding one past an hour gets ExpiredProviderToken). Cached at module
// level — best-effort under serverless cold starts, which is fine: a cold
// start mints fresh, well inside the window.
const JWT_MAX_AGE_MS = 50 * 60_000;
let cachedJwt: { token: string; mintedAt: number } | null = null;

function providerJwt(nowMs: number): string | null {
  if (cachedJwt && nowMs - cachedJwt.mintedAt < JWT_MAX_AGE_MS) {
    return cachedJwt.token;
  }
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  // Base64-encoded .p8 PEM: pasting multi-line PEM into hosting env UIs
  // mangles the newlines, and base64 side-steps that whole class of bug.
  const keyB64 = process.env.APNS_PRIVATE_KEY_B64;
  if (!keyId || !teamId || !keyB64) {
    console.error(
      "[push] APNS env missing:",
      [
        keyId ? null : "APNS_KEY_ID",
        teamId ? null : "APNS_TEAM_ID",
        keyB64 ? null : "APNS_PRIVATE_KEY_B64",
      ]
        .filter(Boolean)
        .join(", ")
    );
    return null;
  }
  try {
    const pem = Buffer.from(keyB64, "base64").toString("utf8");
    const token = mintApnsJwt(pem, keyId, teamId, nowMs);
    cachedJwt = { token, mintedAt: nowMs };
    return token;
  } catch (err) {
    console.error("[push] APNs JWT mint failed:", err);
    return null;
  }
}

// POST one alert to one device. "gone" means the token is dead and its row
// should be deleted (410 Unregistered, or the 400/BadDeviceToken a
// wrong-environment token produces); "error" is everything else, already
// logged.
export function sendApnsAlert(
  deviceToken: string,
  alert: ApnsAlert
): Promise<ApnsResult> {
  const jwt = providerJwt(Date.now());
  if (!jwt) return Promise.resolve("error");

  return new Promise((resolve) => {
    const done = (r: ApnsResult) => {
      // http2 can surface both an 'error' and a 'close' — settle once.
      if (!settled) {
        settled = true;
        session.close();
        resolve(r);
      }
    };
    let settled = false;

    const session = connect(`https://${apnsHost()}`);
    session.on("error", (err) => {
      console.error("[push] APNs connection failed:", err);
      done("error");
    });
    // A hung socket must not pin the after() callback to the route's max
    // duration — 10s is generous for one small POST.
    session.setTimeout(10_000, () => {
      console.error("[push] APNs timed out");
      done("error");
    });

    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      // Deliver within a day if the phone is offline — 0 would mean "now or
      // never", and a like is still news tonight.
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 86_400),
      "content-type": "application/json",
    });

    let status = 0;
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });

    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      if (status === 200) {
        done("ok");
        return;
      }
      if (status === 410 || body.includes("BadDeviceToken")) {
        done("gone");
        return;
      }
      console.error(`[push] APNs rejected (${status}):`, body);
      done("error");
    });
    req.on("error", (err) => {
      console.error("[push] APNs request failed:", err);
      done("error");
    });

    req.end(
      JSON.stringify({
        aps: { alert: { title: alert.title, body: alert.body }, sound: "default" },
        url: alert.url,
      })
    );
  });
}
