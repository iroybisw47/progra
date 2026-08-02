// Where Supabase sends the browser after Google consent, on native only.
//
// Google refuses OAuth inside an embedded webview (disallowed_useragent), so
// the consent screen opens in the system browser and has to get back into the
// app somehow — this custom scheme is that door. It must stay in sync with
// CFBundleURLTypes in ios/App/App/Info.plist AND be listed in Supabase's
// Redirect URLs allowlist, or the consent screen completes and dead-ends.
//
// Lives in its own module, apart from lib/native.ts, precisely because that one
// imports @capacitor/core: this constant is needed by a "use server" action too,
// and pulling a native plugin into the server bundle would be wrong.
export const NATIVE_AUTH_REDIRECT = "world.progra.app://auth/callback";
