// Google iOS OAuth client ID, from Google Cloud Console → Credentials → an
// OAuth client of type **iOS** whose bundle ID is world.progra.app.
//
// NEXT_PUBLIC_ because the native picker needs it in the client bundle. It's not
// a secret — an iOS client ID has no secret by design; the bundle ID plus
// Apple's app attestation is what binds a token to this app.
//
// Two places must agree or sign-in fails with an audience error:
//   1. Info.plist CFBundleURLTypes gets the REVERSED form of this id
//      (com.googleusercontent.apps.xxxx), which the Google SDK needs to return
//      control to the app.
//   2. Supabase → Auth → Providers → Google → "Authorized Client IDs" must list
//      this id, or Supabase rejects the idToken as having the wrong audience.
export const GOOGLE_IOS_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
