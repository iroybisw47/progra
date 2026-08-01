import { Capacitor } from "@capacitor/core";

// Are we running inside the Capacitor iOS shell rather than a normal browser?
//
// The shell is a thin webview over production (capacitor.config.ts sets
// server.url = https://progra.world), so the SAME client bundle serves both the
// website and the app — every native-only branch has to be gated on this.
//
// The window guard matters: this is imported by client components that Next
// still server-renders, where Capacitor's globals don't exist.
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

// Where Supabase sends the browser after Google consent, on native only.
//
// Google refuses OAuth inside an embedded webview (disallowed_useragent), so
// the consent screen opens in the system browser and has to get back into the
// app somehow — this custom scheme is that door. It must stay in sync with
// CFBundleURLTypes in ios/App/App/Info.plist AND be listed in Supabase's
// Redirect URLs allowlist, or the consent screen completes and dead-ends.
export const NATIVE_AUTH_REDIRECT = "world.progra.app://auth/callback";
