"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { NATIVE_AUTH_REDIRECT, isNativeApp } from "@/lib/native";

// MODULE scope, deliberately — not component state, not a ref.
//
// The native listener lives in Capacitor's plugin registry, which is global and
// outlives the React tree. Keeping this in the effect closure meant a second
// mount happily added a SECOND listener, so one appUrlOpen delivery ran the
// handler twice.
//
// One registration per page lifetime is exactly right here: this component sits
// in the root layout and only ever goes away when the page does. Handing off to
// /auth/callback unloads the page, which resets this module and re-registers
// cleanly on the next load.
let listenerRegistered = false;

// Callback URLs already handed off, so a redelivery can't navigate twice. iOS
// can fire appUrlOpen more than once for a single URL (app resume / foreground
// transitions are the usual culprits).
const handledCallbacks = new Set<string>();

// Finishes native Google sign-in. GoogleSignInButton opens Google consent in the
// system browser (embedded webviews are refused by Google); Supabase redirects
// to our custom scheme, iOS hands the URL to the app, and this leaf routes it
// into the server callback.
//
// It deliberately does NOT exchange the code itself. The PKCE code_verifier is
// stored as an ordinary cookie (httpOnly: false, path /, on progra.world) under
// a storage key both clients derive identically — so the SERVER already receives
// it on every request and can do the exchange. Handing off to /auth/callback
// therefore reuses the exact path the website has used in production for months:
// exchange, claim_invite for ?ref=, safeNextPath on ?next=, redirect.
//
// The previous client-side exchange kept failing with "invalid flow state, no
// valid flow state found" — the verifier was going missing between
// signInWithOAuth and exchangeCodeForSession. Routing the code to the server
// removes that entire class of failure rather than guessing at which step lost
// the cookie.
export function NativeAuthListener() {
  useEffect(() => {
    if (!isNativeApp()) return;
    // Guard before the async work starts, so two mounts in the same tick can't
    // both get past it.
    if (listenerRegistered) return;
    listenerRegistered = true;

    (async () => {
      // Both plugins load up front. Browser especially: resolving its module
      // inside the handler put a dynamic import between "callback arrived" and
      // Browser.close(), so the Safari sheet visibly lingered.
      const [{ App }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
      ]);

      await App.addListener("appUrlOpen", ({ url }) => {
        if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;

        // Dedupe first and synchronously, before anything async.
        if (handledCallbacks.has(url)) return;
        handledCallbacks.add(url);

        // Dismiss the sheet immediately; don't make the handoff wait on it.
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

        const code = params.get("code");
        if (!code) return;

        // Hand off to the server route. Params are forwarded verbatim —
        // /auth/callback already runs safeNextPath on `next` (so a spoofed deep
        // link can't turn into an open redirect) and claim_invite validates
        // `ref` itself, so re-checking here would only risk diverging from it.
        const forward = new URLSearchParams({ code });
        const next = params.get("next");
        const ref = params.get("ref");
        if (next) forward.set("next", next);
        if (ref) forward.set("ref", ref);

        window.location.assign(`/auth/callback?${forward.toString()}`);
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
