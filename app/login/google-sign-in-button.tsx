"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/native";
import { GOOGLE_IOS_CLIENT_ID } from "@/lib/native-auth";
import { signInWithGoogleIdToken } from "@/app/actions/native-auth";

// MODULE scope, not component state: at most one native sign-in at a time. A
// remount would reset component state while the native picker is still up.
let nativeFlowInFlight = false;

// RAW nonce to Google, its SHA-256 to Supabase.
//
// Arrived at by elimination, not by reading docs — the docs are wrong here.
// Writing g for what Google does to the nonce before embedding it in the token
// and s for what Supabase does to the nonce we hand it, a match needs
// s(Y) == g(X) for X sent to Google and Y sent to Supabase. Two live failures
// pin the pair:
//
//   attempt 1  X = SHA(raw), Y = raw  -> "nonces mismatch"
//   attempt 2  X = Y = v              -> "nonces mismatch"
//
//   g=id, s=id   attempt 2 would have matched   -> out
//   g=id, s=SHA  attempt 1 would have matched   -> out
//   g=SHA, s=SHA attempt 2 would have matched   -> out
//   g=SHA, s=id  both mismatch                  -> the only survivor
//
// So Google hashes and Supabase compares verbatim, and Y must be SHA256(X).
// auth-js's typing claims Supabase compares "the hash of this value"; that is
// either wrong or Apple-only. The plugin itself hashes nothing — its iOS source
// passes our value straight to GIDSignIn.signIn(nonce:).
function buildNonce(): Promise<{ forGoogle: string; forSupabase: string }> {
  const forGoogle = crypto.randomUUID() + crypto.randomUUID();
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(forGoogle))
    .then((digest) => ({
      forGoogle,
      // Lowercase hex.
      forSupabase: Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    }));
}

export function GoogleSignInButton({
  next,
  referrer,
  label = "Continue with Google",
}: {
  next?: string;
  // Inviter's username (from /i/[username]). Carried through OAuth as `?ref=` so
  // /auth/callback can call claim_invite after sign-in. Named `referrer`, not
  // `ref`, because React intercepts a `ref` prop and it would never arrive here.
  referrer?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();

    // Native (Capacitor): sign in through the OS Google account picker and
    // trade the resulting idToken for a session server-side. No browser hop, no
    // auth code, no deep link — see app/actions/native-auth.ts for why the
    // browser/PKCE flow was abandoned.
    if (isNativeApp()) {
      // Guards a second tap while the native picker is already up.
      if (nativeFlowInFlight) return;
      nativeFlowInFlight = true;

      try {
        const { SocialLogin } = await import("@capgo/capacitor-social-login");

        // Idempotent, but it needs the iOS client ID — without it the picker
        // fails with an unhelpful native error, so say so plainly instead.
        if (!GOOGLE_IOS_CLIENT_ID) {
          throw new Error("Missing NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID.");
        }
        await SocialLogin.initialize({
          google: { iOSClientId: GOOGLE_IOS_CLIENT_ID },
        });

        // Raw to Google, its SHA-256 to Supabase — see buildNonce.
        const nonce = await buildNonce();

        const res = await SocialLogin.login({
          provider: "google",
          options: { scopes: ["email", "profile"], nonce: nonce.forGoogle },
        });

        // Two unions to get through: the result varies by provider, and
        // Google's own result splits online/offline — only the online shape
        // carries idToken.
        const idToken =
          res.provider === "google" && "idToken" in res.result
            ? res.result.idToken
            : null;
        if (!idToken) {
          throw new Error("Google didn't return an identity token.");
        }

        const out = await signInWithGoogleIdToken({
          idToken,
          nonce: nonce.forSupabase,
          next,
          ref: referrer,
        });
        if ("error" in out) {
          nativeFlowInFlight = false;
          setLoading(false);
          toast.error(out.error);
          return;
        }

        // Hard navigation so the server re-reads the session cookie the action
        // just wrote. Loading stays on through the navigation.
        window.location.assign(out.next);
      } catch (err) {
        nativeFlowInFlight = false;
        setLoading(false);
        // A cancelled picker throws too; don't shout about it.
        const msg = err instanceof Error ? err.message : "Couldn't sign in.";
        if (!/cancel/i.test(msg)) toast.error(msg);
      }
      return;
    }

    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);
    if (referrer) redirectTo.searchParams.set("ref", referrer);

    // Basic sign-in only (openid/email/profile — Supabase's defaults). The
    // Calendar scope is NOT requested here: calendar access is a separate
    // opt-in connect flow (/auth/google-calendar), so new users never hit the
    // unverified-app screen or count against Google's unverified-user cap
    // just to sign in.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
    // On success the browser is redirected to Google; no further action.
  }

  return (
    <Button
      className="h-11 w-full text-base"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Redirecting…" : label}
    </Button>
  );
}
