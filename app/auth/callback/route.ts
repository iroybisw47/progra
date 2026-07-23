import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Default to Home: it hosts the onboarding gate, so brand-new users get
  // routed into /onboarding on their very first load.
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // NOTE: Google provider tokens are deliberately NOT captured here anymore.
  // Sign-in requests only basic scopes, so the session's provider_token is
  // calendar-useless — persisting it would clobber the calendar tokens the
  // opt-in connect flow (/auth/google-calendar) stores with a fresh expiry,
  // breaking sync for up to an hour after every re-login. Token writes are
  // exclusively the connect flow's job.

  // When deployed behind a proxy (Vercel), honor x-forwarded-host so the
  // redirect lands on the public origin, not the internal host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const target = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

  return NextResponse.redirect(`${target}${next}`);
}
