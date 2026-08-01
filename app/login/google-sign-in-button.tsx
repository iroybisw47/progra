"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { NATIVE_AUTH_REDIRECT, isNativeApp } from "@/lib/native";

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
      // Built by hand: the WHATWG URL parser treats a custom scheme as a
      // non-special URL and mangles host/path, so `new URL()` + searchParams
      // isn't safe here the way it is for the https redirect below.
      const params = new URLSearchParams();
      if (next) params.set("next", next);
      if (referrer) params.set("ref", referrer);
      const qs = params.toString();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${NATIVE_AUTH_REDIRECT}${qs ? `?${qs}` : ""}`,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        setLoading(false);
        toast.error(error.message);
        return;
      }
      if (data?.url) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: data.url });
      }
      // The browser sheet now covers the app. Release the button so dismissing
      // it without signing in doesn't strand us on "Redirecting…".
      setLoading(false);
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
