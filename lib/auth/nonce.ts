// Nonce pairing for native OIDC sign-in (Google and Apple both).
//
// Client-only by construction: crypto.subtle exists in the browser/WKWebView,
// not on the server. No "server-only" marker here — the opposite is true.

// SHA-256 to the identity provider, the raw value to Supabase — the standard
// OIDC pairing. The provider embeds whatever nonce it's given verbatim, and
// Supabase hashes the value you hand it before comparing (per auth-js: "the
// hash of this value is compared to the value in the ID token").
//
// Earlier attempts appeared to disprove this and pointed at other pairings, but
// those tests were void: the Google plugin was returning a CACHED token via
// restorePreviousSignIn, which never carried our nonce at all. See forcePrompt
// in google-sign-in-button.tsx — without it, no pairing can ever match.
//
// Apple's native sheet has no equivalent cache path, so it needs no such flag,
// but the pairing itself is identical.
export async function buildNonce(): Promise<{
  forProvider: string;
  forSupabase: string;
}> {
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  return {
    // Lowercase hex.
    forProvider: Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    forSupabase: raw,
  };
}
