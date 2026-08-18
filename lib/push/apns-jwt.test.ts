import { generateKeyPairSync, verify as cryptoVerify } from "node:crypto";
import { describe, expect, it } from "vitest";

import { mintApnsJwt } from "@/lib/push/apns-jwt";

// A throwaway P-256 keypair — the same curve as an Apple .p8 — so the ES256
// signature can be verified for real, not just shape-checked.
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

describe("mintApnsJwt", () => {
  const NOW = 1_755_500_000_000;
  const jwt = mintApnsJwt(privateKey, "KEY123", "TEAM456", NOW);
  const [header, claims, signature] = jwt.split(".");

  it("carries the ES256 header with the key id", () => {
    expect(decodePart(header)).toEqual({ alg: "ES256", kid: "KEY123" });
  });

  it("claims the team as issuer with iat in seconds", () => {
    expect(decodePart(claims)).toEqual({
      iss: "TEAM456",
      iat: Math.floor(NOW / 1000),
    });
  });

  // Apple rejects DER-encoded signatures as InvalidProviderToken — the JWT
  // spec wants raw r||s (ieee-p1363), which for P-256 is exactly 64 bytes.
  it("signs with a verifiable 64-byte ieee-p1363 ES256 signature", () => {
    const sig = Buffer.from(signature, "base64url");
    expect(sig.length).toBe(64);
    const valid = cryptoVerify(
      "sha256",
      Buffer.from(`${header}.${claims}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      sig
    );
    expect(valid).toBe(true);
  });
});
