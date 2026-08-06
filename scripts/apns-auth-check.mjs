// DEBUG TOOL — added 2026-08-05. Standalone: nothing in the app imports this,
// and Progra still has no push *sender*. This only answers one question —
// "are my APNs credentials configured correctly?" — without needing a device.
//
// It signs a provider JWT and sends one push to a deliberately fake device
// token. A rejection naming the TOKEN means the credentials were accepted.
//
//   node scripts/apns-auth-check.mjs --key ~/Downloads/AuthKey_ABC1234567.p8 --key-id ABC1234567
//
// Team ID and bundle ID default to this project's real values (read out of
// ios/App/App.xcodeproj), so --key and --key-id are usually all you need.
// Override with --team-id / --bundle-id / --production, or use env vars
// APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID.
//
// No dependencies: node:crypto signs the ES256 JWT, node:http2 talks to Apple.
//
// ---------------------------------------------------------------------------
// DON'T HAVE A KEY YET?
//
// An APNs auth key is NOT the signing certificate Xcode manages for you. That
// one proves the app is yours; this one proves your *server* may send pushes.
// One key works for every app on the team, for both sandbox and production,
// and it never expires.
//
//   developer.apple.com -> Certificates, Identifiers & Profiles -> Keys
//     -> "+" -> name it (e.g. "Progra APNs") -> tick "Apple Push
//        Notifications service (APNs)" -> Continue -> Register -> Download
//
// Apple lets you download the .p8 EXACTLY ONCE. Save it somewhere safe and
// outside this repo. The 10-character Key ID is shown on that page (and is in
// the filename: AuthKey_<KEYID>.p8).
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import fs from "node:fs";
import http2 from "node:http2";
import os from "node:os";
import path from "node:path";

// --- args -------------------------------------------------------------------

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

const keyPath = arg("key") ?? process.env.APNS_KEY_PATH;
const keyId = arg("key-id") ?? process.env.APNS_KEY_ID;
// Defaults lifted from the Xcode project — DEVELOPMENT_TEAM and
// PRODUCT_BUNDLE_IDENTIFIER in ios/App/App.xcodeproj/project.pbxproj.
const teamId = arg("team-id") ?? process.env.APNS_TEAM_ID ?? "4SZA2SXM3Y";
const bundleId =
  arg("bundle-id") ?? process.env.APNS_BUNDLE_ID ?? "world.progra.app";

// App.entitlements is currently aps-environment=development, so sandbox is the
// matching host. Pass --production once that flips for TestFlight.
const useProduction = process.argv.includes("--production");
const host = useProduction
  ? "https://api.push.apple.com"
  : "https://api.sandbox.push.apple.com";

if (!keyPath || !keyId) {
  console.error(
    "Usage: node scripts/apns-auth-check.mjs --key <AuthKey_XXXXXXXXXX.p8> --key-id <XXXXXXXXXX>\n\n" +
      "See the header of this file for how to create the key if you don't have one.\n" +
      `Defaults in use: team ${teamId}, bundle ${bundleId}, host ${host}`
  );
  process.exit(2);
}

const resolved = keyPath.startsWith("~")
  ? path.join(os.homedir(), keyPath.slice(1))
  : path.resolve(keyPath);

if (!fs.existsSync(resolved)) {
  console.error(`No such key file: ${resolved}`);
  process.exit(2);
}

// --- sign the provider JWT ---------------------------------------------------

const p8 = fs.readFileSync(resolved, "utf8");
if (!p8.includes("BEGIN PRIVATE KEY")) {
  console.error(
    `${resolved} doesn't look like an APNs .p8 (expected a PKCS#8 "BEGIN PRIVATE KEY" block).\n` +
      "A .p12 / .cer is the other, certificate-based auth style — this script wants the .p8 key."
  );
  process.exit(2);
}

const b64url = (input) =>
  Buffer.from(input).toString("base64url");

const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
const claims = b64url(
  JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
);
const signingInput = `${header}.${claims}`;

let signature;
try {
  // JWS wants the raw r||s pair; node defaults to DER, hence ieee-p1363.
  signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: p8,
    dsaEncoding: "ieee-p1363",
  });
} catch (err) {
  console.error(`Could not sign with that key: ${err.message}`);
  process.exit(1);
}

const jwt = `${signingInput}.${signature.toString("base64url")}`;

// --- send to a deliberately invalid token ------------------------------------

// Well-formed (64 hex chars) but not a real device, so APNs must reject it.
// Rejecting on the TOKEN means it got past authentication — which is the pass.
const fakeToken = "0".repeat(64);
const body = JSON.stringify({
  aps: { alert: "APNs auth check — not a real notification" },
});

console.log(`host      ${host}`);
console.log(`team      ${teamId}`);
console.log(`key id    ${keyId}`);
console.log(`topic     ${bundleId}`);
console.log(`key       ${resolved}\n`);

const client = http2.connect(host);
client.on("error", (err) => {
  console.error(`Connection failed: ${err.message}`);
  process.exit(1);
});

const req = client.request({
  ":method": "POST",
  ":path": `/3/device/${fakeToken}`,
  authorization: `bearer ${jwt}`,
  "apns-topic": bundleId,
  "apns-push-type": "alert",
  "content-type": "application/json",
});

let status = 0;
let payload = "";

req.on("response", (headers) => {
  status = headers[":status"];
});
req.setEncoding("utf8");
req.on("data", (chunk) => {
  payload += chunk;
});

req.on("end", () => {
  client.close();

  let reason = "";
  try {
    reason = JSON.parse(payload).reason ?? "";
  } catch {
    reason = payload.trim();
  }

  console.log(`HTTP ${status}  ${reason || "(no reason given)"}\n`);

  // BadDeviceToken is the goal: Apple validated the JWT, the key, the team and
  // the topic, and only then objected to the fake token.
  if (reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic") {
    console.log("PASS — APNs credentials are configured correctly.");
    console.log(
      "Apple accepted the auth key and rejected only the fake device token,\n" +
        "which is exactly what should happen."
    );
    process.exit(0);
  }

  const diagnoses = {
    InvalidProviderToken:
      "The key, Key ID and Team ID don't agree — or the key isn't APNs-enabled.\n" +
      "Check --key-id matches the filename (AuthKey_<KEYID>.p8) and that the\n" +
      `team is right (currently ${teamId}).`,
    ExpiredProviderToken:
      "The JWT was rejected as expired. Almost always machine clock skew —\n" +
      "check your system time.",
    MissingProviderToken: "No auth header reached Apple — likely a bug in this script.",
    BadTopic: `Apple doesn't recognise the topic "${bundleId}" for this team.`,
    TopicDisallowed: `"${bundleId}" isn't permitted for this key — check the App ID has\nPush Notifications enabled in the developer portal.`,
    Forbidden: "The key is not authorised for this team.",
  };

  console.log("FAIL — credentials are NOT correct.");
  if (diagnoses[reason]) console.log(`\n${diagnoses[reason]}`);
  else
    console.log(
      `\nUnrecognised response. Apple's reason codes are listed at\n` +
        `https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns`
    );
  process.exit(1);
});

req.on("error", (err) => {
  console.error(`Request failed: ${err.message}`);
  process.exit(1);
});

req.end(body);
