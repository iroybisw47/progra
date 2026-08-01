"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { safeNextPath } from "@/lib/auth/safe-next";
import { NATIVE_AUTH_REDIRECT, isNativeApp } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";

// MODULE scope, deliberately — not component state, not a ref.
//
// The native listener lives in Capacitor's plugin registry, which is global and
// outlives any React tree. Keeping the "have we registered?" flag in the effect
// closure meant a second mount happily added a SECOND listener, so one
// appUrlOpen delivery ran the handler twice and both calls raced to spend the
// same single-use PKCE code. The loser errored and toasted, which read as
// "login is flaky" even though the winner had signed the user in.
//
// One registration per page lifetime is exactly right here: this component sits
// in the root layout and only ever goes away when the page does — and the page
// unloading tears the listener down with it. After a successful exchange we do
// a hard navigation, which reloads the page, resets this module, and registers
// cleanly once more.
let listenerRegistered = false;

// Callback URLs already handled, so a redelivery can't spend the code twice.
// iOS can fire appUrlOpen more than once for a single URL (app resume /
// foreground transitions are the usual culprits), and an auth code is
// single-use: the second exchange fails and surfaces a spurious error.
const handledCallbacks = new Set<string>();

// Finishes native Google sign-in. GoogleSignInButton opens Google consent in
// the system browser (embedded webviews are refused by Google); Supabase then
// redirects to our custom scheme, iOS hands the URL to the app, and this leaf
// completes the exchange.
//
// Mounted app-wide in the root layout — for signed-OUT visitors too, since
// that's exactly who is signing in — because the deep link can arrive on any
// screen, not just /login. No-op on web.
//
// Why a client-side exchange is safe here: capacitor.config.ts points the
// webview at https://progra.world, so the session cookies createBrowserClient
// writes are first-party to that origin and the Next server reads them on the
// next navigation. On a bundled build (capacitor://localhost) this would not
// work and the exchange would have to happen server-side.
export function NativeAuthListener() {
  useEffect(() => {
    if (!isNativeApp()) return;
    // Guard before the async work starts, so two mounts in the same tick can't
    // both get past it.
    if (listenerRegistered) return;
    listenerRegistered = true;

    (async () => {
      // Both plugins are loaded up front. Browser especially: resolving its
      // module inside the handler put a dynamic import between "callback
      // arrived" and Browser.close(), so the Safari sheet visibly lingered.
      // Preloading makes the close a plain call with nothing awaited before it.
      const [{ App }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
      ]);

      await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;

        // Dedupe FIRST, synchronously — before any await, so two deliveries in
        // the same tick can't both slip through into the exchange.
        if (handledCallbacks.has(url)) return;
        handledCallbacks.add(url);

        // Dismiss the sheet immediately; don't make the exchange wait on it.
        // Best-effort — iOS has often closed it already, and a failure here
        // must not abort sign-in.
        Browser.close().catch(() => {
          // already closed
        });

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
          // Let this URL be retried — the code is spent, but re-arming keeps a
          // genuine transient failure (offline mid-exchange) recoverable if the
          // OS redelivers, rather than silently swallowing it.
          handledCallbacks.delete(url);
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
        window.location.assign(safeNextPath(params.get("next")));
      });
    })().catch((err) => {
      // Setup failed (module load, plugin missing) — let a later mount retry.
      listenerRegistered = false;
      console.error("Native auth listener setup failed:", err);
    });

    // No cleanup that removes the listener, on purpose. Its correct lifetime is
    // the page, not this component: removing it on an incidental remount would
    // drop the callback if the deep link landed in that window.
  }, []);

  return null;
}
