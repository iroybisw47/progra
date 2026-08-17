"use client";

import { useState } from "react";
import { toast } from "sonner";

import { signInWithAppleIdToken } from "@/app/actions/native-auth";
import { Button } from "@/components/ui/button";
import { buildNonce } from "@/lib/auth/nonce";
import { useIsNativeApp } from "@/lib/use-is-native-app";

// MODULE scope, not component state: at most one native sign-in at a time. A
// remount would reset component state while the native sheet is still up.
let nativeFlowInFlight = false;

// Apple's mark. Their guidelines require the logo plus "Sign in with Apple" on
// a black or white button — a plain text button is a known 4.8 review nitpick.
function AppleMark() {
  return (
    <svg viewBox="0 0 384 512" aria-hidden="true" className="size-4 fill-current">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

// Sign in with Apple. NATIVE ONLY — renders nothing on progra.world, which
// shares this bundle. Apple's Guideline 4.8 requires this option wherever the
// app offers Google, with equal prominence; the website is unaffected by that
// rule and has no Apple provider configured.
export function AppleSignInButton({
  next,
  referrer,
  label = "Sign in with Apple",
}: {
  next?: string;
  // Inviter's username, carried through so the action can call claim_invite.
  // Named `referrer`, not `ref`, because React intercepts a `ref` prop.
  referrer?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const isNative = useIsNativeApp();

  // After the hooks, so hook order is identical on every render.
  if (!isNative) return null;

  async function handleClick() {
    if (nativeFlowInFlight) return;
    nativeFlowInFlight = true;
    setLoading(true);

    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");

      // Idempotent. clientId/redirectUrl are for web and Android only — on iOS
      // the native sheet needs neither, and passing a redirect URL makes it try
      // to bounce through a browser.
      await SocialLogin.initialize({ apple: {} });

      // Hex digest to Apple, raw value to Supabase — same OIDC pairing Google
      // uses. Unlike Google there's no cached-token path to defeat, so no
      // forcePrompt equivalent is needed.
      const nonce = await buildNonce();

      const res = await SocialLogin.login({
        provider: "apple",
        options: {
          // Apple honours these on the FIRST authorization only; later sign-ins
          // return nulls no matter what we ask for. Nothing downstream reads
          // them — see signInWithAppleIdToken.
          scopes: ["name", "email"],
          nonce: nonce.forProvider,
        },
      });

      const idToken =
        res.provider === "apple" && "idToken" in res.result
          ? res.result.idToken
          : null;
      if (!idToken) {
        throw new Error("Apple didn't return an identity token.");
      }

      const out = await signInWithAppleIdToken({
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
      // Dismissing the sheet throws too; don't shout about it.
      const msg = err instanceof Error ? err.message : "Couldn't sign in.";
      if (!/cancel/i.test(msg)) toast.error(msg);
    }
  }

  return (
    <Button
      // Same height as the Google button — 4.8 asks for equal prominence, and
      // the two sit directly above one another.
      className="h-11 w-full bg-black text-base text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        "Signing in…"
      ) : (
        <>
          <AppleMark />
          {label}
        </>
      )}
    </Button>
  );
}
