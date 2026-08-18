import { createPrivateKey, sign as cryptoSign } from "node:crypto";

// The ES256 provider JWT, minted by hand — pure given its inputs (key
// material, ids, the clock), so the signature and claims are unit-testable
// with a throwaway keypair, no Apple involved. Kept out of lib/push/apns.ts
// only because that file is `server-only`, which vitest cannot import; this
// one holds no secrets — the key comes in as an argument.

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

export function mintApnsJwt(
  privateKeyPem: string,
  keyId: string,
  teamId: string,
  nowMs: number
): string {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(
    JSON.stringify({ iss: teamId, iat: Math.floor(nowMs / 1000) })
  );
  const signingInput = `${header}.${claims}`;
  // ieee-p1363 (raw r||s), not DER — JWTs require the fixed-width encoding,
  // and Apple rejects DER-signed tokens with InvalidProviderToken.
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(signature)}`;
}
