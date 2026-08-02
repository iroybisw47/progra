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

// NATIVE_AUTH_REDIRECT lives in lib/native-auth.ts, not here: a "use server"
// action needs it too, and this module imports @capacitor/core — which has no
// business in the server bundle.
