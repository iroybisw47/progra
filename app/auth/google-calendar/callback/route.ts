import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { CALENDAR_SCOPE } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import {
  GCAL_STATE_COOKIE,
  callbackUri,
  parseFrom,
  publicOrigin,
  returnPath,
  type ConnectFrom,
} from "@/lib/google/connect";
import { revalidateCalendarSurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: "Bearer";
};

// Completes the opt-in calendar connection. The identity tokens are bound to
// comes from OUR session cookie, never from anything Google echoes; the state
// nonce is validated against our cookie BEFORE any token exchange.
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);

  const user = await getCurrentUser();
  if (!user) {
    // No session → no exchange, ever.
    return NextResponse.redirect(`${origin}/login`);
  }

  // Read + clear the nonce cookie (one-shot).
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(GCAL_STATE_COOKIE)?.value ?? null;
  cookieStore.delete(GCAL_STATE_COOKIE);

  let nonce: string | null = null;
  let from: ConnectFrom = "settings";
  if (rawCookie) {
    try {
      const parsed = JSON.parse(rawCookie) as { nonce?: string; from?: string };
      nonce = typeof parsed.nonce === "string" ? parsed.nonce : null;
      from = parseFrom(parsed.from ?? null);
    } catch {
      // Malformed cookie → treated as missing.
    }
  }

  const fail = () => NextResponse.redirect(`${origin}${returnPath(from, false)}`);

  // CSRF check BEFORE any exchange: Google's echoed state must match our
  // cookie nonce exactly.
  const state = request.nextUrl.searchParams.get("state");
  if (!nonce || !state || state !== nonce) return fail();

  // User cancelled at the consent screen (or Google errored).
  if (request.nextUrl.searchParams.get("error")) return fail();

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return fail();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUri(request),
    }),
  });
  if (!res.ok) return fail();

  const tokens = (await res.json()) as TokenResponse;

  // Users can uncheck scopes on the consent screen; without the calendar
  // scope (or a refresh token) the grant is useless — store nothing.
  if (!tokens.scope?.includes(CALENDAR_SCOPE) || !tokens.refresh_token) {
    return fail();
  }

  // Standard server client — the user's own row, RLS applies.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      google_provider_token: tokens.access_token,
      google_provider_refresh_token: tokens.refresh_token,
      google_token_expires_at: new Date(
        Date.now() + (tokens.expires_in - 60) * 1000
      ).toISOString(),
      google_scopes: tokens.scope,
    })
    .eq("id", user.id);
  if (error) return fail();

  revalidateCalendarSurfaces();
  return NextResponse.redirect(`${origin}${returnPath(from, true)}`);
}
