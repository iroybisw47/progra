"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/native";
import { startNativeGoogleSignIn } from "@/app/actions/native-auth";

// MODULE scope, not component state: at most one native OAuth flow may be in
// flight per page lifetime.
//
// Every signInWithOAuth call mints a NEW PKCE code_verifier and OVERWRITES the
// stored one. So a second flow started while the first is still open orphans
// the first: when its callback comes back, the code no longer matches the
// stored verifier and the exchange fails with "invalid flow state, no valid
// flow state found". Component state can't be the guard — a remount resets it,
// while the verifier cookie survives.
let nativeFlowInFlight = false;

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

    // Native (Capacitor): Google refuses OAuth in an embedded webview, so ask
    // Supabase for the consent URL instead of letting it navigate us, and hand
    // that URL to the system browser. The round trip comes back through the
    // custom scheme and is finished by <NativeAuthListener/> in the root
    // layout — this component's job ends at opening the browser.
    if (isNativeApp()) {
      // A flow is already open (button remounted, or a stray second tap) —
      // starting another would overwrite the pending verifier.
      if (nativeFlowInFlight) return;
      nativeFlowInFlight = true;

      try {
        const { Browser } = await import("@capacitor/browser");

        // Release the button when the sheet closes for ANY reason — completed,
        // swiped away, cancelled. Registered BEFORE open so the event can't be
        // missed. This replaces the old unconditional setLoading(false) after
        // open(), which re-enabled the button while the sheet was still up and
        // let a second tap clobber the in-flight flow's code_verifier.
        const finished = await Browser.addListener("browserFinished", () => {
          nativeFlowInFlight = false;
          setLoading(false);
          finished.remove();
        });

        // Deliberately NOT supabase.auth.signInWithOAuth() here. Whichever
        // client makes that call is the one that stores the PKCE code_verifier,
        // and the browser client stores it via document.cookie — which
        // WKWebView flushes lazily and can drop while the app is backgrounded
        // behind the Safari sheet. Running it on the server instead writes the
        // verifier as a real Set-Cookie header, which WebKit commits at once.
        // See app/actions/native-auth.ts.
        const res = await startNativeGoogleSignIn({ next, ref: referrer });
        if ("error" in res) {
          finished.remove();
          nativeFlowInFlight = false;
          setLoading(false);
          toast.error(res.error);
          return;
        }
        await Browser.open({ url: res.url });
        // Deliberately NOT clearing loading here — browserFinished owns that,
        // so the button stays disabled for as long as the sheet is up.
      } catch (err) {
        nativeFlowInFlight = false;
        setLoading(false);
        toast.error(
          err instanceof Error ? err.message : "Couldn't start sign-in."
        );
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
