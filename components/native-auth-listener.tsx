"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { safeNextPath } from "@/lib/auth/safe-next";
import { NATIVE_AUTH_REDIRECT, isNativeApp } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";

// Finishes native Google sign-in. GoogleSignInButton opens Google consent in
// the system browser (embedded webviews are refused by Google); Supabase then
// redirects to our custom scheme, iOS hands the URL to the app, and this leaf
// completes the exchange.
//
// Mounted app-wide in the root layout — for signed-OUT visitors too, since
// that's exactly who is signing in — because the deep link can arrive on any
// screen, not just /login. Same "client leaf that does nothing until it has
// to" shape as EnsureProfileSync / EnsureSessionCap. No-op on web.
//
// Why a client-side exchange is safe here: capacitor.config.ts points the
// webview at https://progra.world, so the session cookies createBrowserClient
// writes are first-party to that origin and the Next server reads them on the
// next navigation. On a bundled build (capacitor://localhost) this would not
// work and the exchange would have to happen server-side.
export function NativeAuthListener() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;
    let remove: (() => void) | undefined;

    (async () => {
      // Dynamic import: keeps the native-only plugins out of the web bundle
      // and off the SSR path. Same bundle serves progra.world in a browser.
      const { App } = await import("@capacitor/app");

      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;

        // Dismiss the system browser sheet. Best-effort — on some flows iOS has
        // already closed it, and failing to close must not abort the sign-in.
        try {
          const { Browser } = await import("@capacitor/browser");
          await Browser.close();
        } catch {
          // already closed
        }

        const params = new URLSearchParams(url.split("?")[1] ?? "");

        // Google/Supabase report a refusal or cancel on the query string.
        const authError =
          params.get("error_description") ?? params.get("error");
        if (authError) {
          toast.error(authError);
          return;
        }

        // exchangeCodeForSession takes the auth CODE, not the callback URL.
        const code = params.get("code");
        if (!code) return;

        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          return;
        }

        // Invite attribution, mirroring app/auth/callback/route.ts: the same
        // SECURITY DEFINER RPC, callable from the browser client because it
        // derives the caller from auth.uid(). Attribution must NEVER block
        // sign-in, so every failure is swallowed.
        const ref = params.get("ref");
        if (ref) {
          try {
            await supabase.rpc("claim_invite", { p_username: ref });
          } catch {
            // ignore — sign-in proceeds without attribution
          }
        }

        // Hard navigation, not router.refresh(): this guarantees the server
        // re-reads the session cookie the exchange just wrote. safeNextPath
        // gives native the same open-redirect protection as the web route.
        if (!cancelled) {
          window.location.assign(safeNextPath(params.get("next")));
        }
      });

      if (cancelled) {
        handle.remove();
        return;
      }
      remove = () => handle.remove();
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  return null;
}
