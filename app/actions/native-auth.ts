"use server";

import { createClient } from "@/lib/supabase/server";
import { NATIVE_AUTH_REDIRECT } from "@/lib/native-auth";

type Result = { url: string } | { error: string };

// Starts the native Google flow ON THE SERVER, and returns the consent URL for
// the client to hand to the system browser.
//
// The point of doing this server-side is WHERE the PKCE code_verifier gets
// written. signInWithOAuth stores it through whichever Supabase client calls it:
//
//   - browser client → document.cookie. WKWebView keeps JS-written cookies in
//     memory and flushes them to the shared store lazily, and this flow
//     backgrounds the app for the Safari sheet in between. The verifier was
//     going missing there, which is what produced "invalid flow state, no valid
//     flow state found" for both the old client-side exchange AND the
//     server-side one — the cookie simply wasn't there to read.
//   - server client → a real Set-Cookie response header, which WebKit commits
//     to the cookie store immediately.
//
// Same cookie, same storage key, same base64url encoding — only the write path
// changes, from fragile to durable. /auth/callback then finds the verifier
// waiting for it exactly as it does on the website.
export async function startNativeGoogleSignIn(input: {
  next?: string;
  ref?: string;
}): Promise<Result> {
  const supabase = await createClient();

  // Built by hand: the WHATWG URL parser treats a custom scheme as a
  // non-special URL and mangles host/path, so `new URL()` + searchParams isn't
  // safe here. These ride through Google and come back on the deep link, which
  // forwards them to /auth/callback — where safeNextPath and claim_invite do
  // the validating.
  const params = new URLSearchParams();
  if (input.next) params.set("next", input.next);
  if (input.ref) params.set("ref", input.ref);
  const qs = params.toString();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${NATIVE_AUTH_REDIRECT}${qs ? `?${qs}` : ""}`,
      // Return the URL instead of trying to navigate — there's no window here,
      // and the client hands it to the system browser anyway.
      skipBrowserRedirect: true,
      // The consent screen opens in the system browser, which carries Safari's
      // cookies — without this Google silently reuses whichever account is
      // already signed in there, with no way to pick a different one.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) return { error: error.message };
  if (!data?.url) return { error: "Couldn't start sign-in." };
  return { url: data.url };
}
