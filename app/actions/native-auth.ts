"use server";

import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; next: string } | { error: string };

// Trades a Google idToken (obtained natively, by the OS account picker) for a
// Supabase session. This is the whole of native sign-in.
//
// It replaces a browser-based OAuth round trip that never worked in the shell.
// That flow was: open Google in the system browser → deep link back with an
// auth code → exchange the code against a PKCE code_verifier. It failed
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
export async function signInWithGoogleIdToken(input: {
  idToken: string;
  // The SAME nonce that was handed to Google — not a hash of it. Hashing on
  // exactly one side yields "nonces mismatch"; omitting it entirely yields
  // "passed nonce and nonce in id_token should either both exist or not". See
  // buildNonce() in the sign-in button.
  nonce?: string;
  next?: string;
  ref?: string;
}): Promise<Result> {
  if (!input.idToken) return { error: "No Google token received." };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: input.idToken,
    ...(input.nonce ? { nonce: input.nonce } : {}),
  });
  if (error) {
    // The usual cause is an audience mismatch: the iOS client ID isn't in
    // Supabase → Auth → Providers → Google → Authorized Client IDs.
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
