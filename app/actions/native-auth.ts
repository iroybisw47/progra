"use server";

import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; next: string } | { error: string };

// The `nonce` claim out of an unverified JWT payload, for server logs only.
// Deliberately does NOT verify the signature — Supabase already did that and
// rejected it; this exists purely to report what the token says.
//
// Kept because getting the nonce pairing right took several rounds, and the one
// thing that finally settled it was seeing the token's actual claim. If a nonce
// error ever comes back, the log line below is the shortcut.
function readNonceClaim(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const nonce = (JSON.parse(json) as { nonce?: unknown }).nonce;
    return typeof nonce === "string" ? nonce : null;
  } catch {
    return null;
  }
}

type NativeProvider = "google" | "apple";

type SignInInput = {
  idToken: string;
  // The SAME nonce that was handed to the provider — not a hash of it. Hashing
  // on exactly one side yields "nonces mismatch"; omitting it entirely yields
  // "passed nonce and nonce in id_token should either both exist or not". See
  // buildNonce() in lib/auth/nonce.ts.
  nonce?: string;
  next?: string;
  ref?: string;
};

// Trades a natively-obtained idToken for a Supabase session. This is the whole
// of native sign-in, for both providers.
//
// It replaces a browser-based OAuth round trip that never worked in the shell.
// That flow was: open the provider in the system browser → deep link back with
// an auth code → exchange the code against a PKCE code_verifier. It failed
// consistently with Supabase's flow_state_not_found, and four separate fixes
// (in-flight guards, local signOut, server-side exchange, server-side verifier
// write) did not move it. Diagnostics eventually confirmed the verifier cookie
// AND the code were both present and correct at exchange time, which exhausted
// every explanation reachable from this codebase.
//
// signInWithIdToken has none of those moving parts: no browser hop, no auth
// code, no flow state, no code_verifier, no deep link. A token goes in and a
// session comes out.
//
// Deliberately server-side. The Supabase SERVER client writes the session as a
// real Set-Cookie response header, which WebKit commits immediately — whereas
// the browser client writes via document.cookie, which WKWebView flushes lazily
// and can drop. Every page in this app is server-rendered from that cookie, so
// it has to land durably.
async function signInWithProviderIdToken(
  provider: NativeProvider,
  input: SignInInput
): Promise<Result> {
  if (!input.idToken) return { error: "No identity token received." };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithIdToken({
    provider,
    token: input.idToken,
    ...(input.nonce ? { nonce: input.nonce } : {}),
  });
  if (error) {
    // A nonce failure means the token's claim and what we sent disagree — log
    // both SERVER-SIDE so it's diagnosable without putting hex strings in front
    // of a user. Only the nonce claim is ever logged, never the token: the
    // token is a credential, a nonce is a single-use random string.
    //
    // On Google, check forcePrompt first — without it GIDSignIn returns a
    // cached token via restorePreviousSignIn that never carried our nonce, and
    // no pairing can match. See the call site in google-sign-in-button.tsx.
    if (/nonce/i.test(error.message)) {
      console.error(
        `[native-auth] ${provider} nonce mismatch — token claim:`,
        readNonceClaim(input.idToken) ?? "none",
        "| sent:",
        input.nonce ?? "none"
      );
    }
    // The other common cause is an audience mismatch. Google: the iOS client ID
    // isn't in Supabase → Auth → Providers → Google → Authorized Client IDs.
    // Apple: the BUNDLE ID (world.progra.app) isn't in that provider's Client
    // IDs — native Apple tokens carry the bundle id as `aud`, never a Services
    // ID, which is web-only.
    return { error: error.message };
  }

  // Invite attribution, mirroring app/auth/callback/route.ts: the same
  // SECURITY DEFINER RPC, which derives the caller from auth.uid(). Attribution
  // must NEVER block sign-in, so every failure is swallowed.
  if (input.ref) {
    try {
      await supabase.rpc("claim_invite", { p_username: input.ref });
    } catch {
      // ignore — sign-in proceeds without attribution
    }
  }

  // Resolved here rather than trusted from the client, matching the web route.
  return { ok: true, next: safeNextPath(input.next) };
}

export async function signInWithGoogleIdToken(
  input: SignInInput
): Promise<Result> {
  return signInWithProviderIdToken("google", input);
}

// Apple sends the user's name and email ONLY on the very first authorization,
// and nothing on every sign-in after. That costs us nothing: no code in this
// app reads provider metadata (profiles get their display name and handle from
// onboarding, where the user types them), and require-user.ts already returns
// a null email when the claim is absent.
export async function signInWithAppleIdToken(
  input: SignInInput
): Promise<Result> {
  return signInWithProviderIdToken("apple", input);
}
