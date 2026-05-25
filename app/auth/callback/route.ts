import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/clock";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Capture Google provider tokens — only available on the session right
  // after the OAuth exchange. Persist to profiles for later API calls.
  const session = data?.session;
  const user = data?.user;
  if (session?.provider_token && user) {
    const updates: {
      google_provider_token: string;
      google_token_expires_at: string;
      google_provider_refresh_token?: string;
    } = {
      google_provider_token: session.provider_token,
      // Google access tokens last ~1h. Store an explicit expiry so the sync
      // layer knows when to refresh.
      google_token_expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
    };
    if (session.provider_refresh_token) {
      updates.google_provider_refresh_token = session.provider_refresh_token;
    }
    await supabase.from("profiles").update(updates).eq("id", user.id);
  }

  // When deployed behind a proxy (Vercel), honor x-forwarded-host so the
  // redirect lands on the public origin, not the internal host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const target = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

  return NextResponse.redirect(`${target}${next}`);
}
