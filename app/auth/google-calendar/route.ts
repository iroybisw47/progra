import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { CALENDAR_SCOPE } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import {
  GCAL_STATE_COOKIE,
  callbackUri,
  parseFrom,
  publicOrigin,
} from "@/lib/google/connect";

// Kick off the opt-in Google Calendar connection: sets a nonce cookie and
// bounces to Google's consent screen requesting ONLY the calendar scope.
// Sign-in never asks for it — this flow is the sole way calendar access is
// granted, from History or Settings.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${publicOrigin(request)}/login`);
  }

  const from = parseFrom(request.nextUrl.searchParams.get("from"));

  // CSRF nonce: the callback validates Google's echoed `state` against this
  // cookie before any token exchange. The return destination also rides in
  // the cookie — never trusted from anything Google echoes back.
  const nonce = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(GCAL_STATE_COOKIE, JSON.stringify({ nonce, from }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: callbackUri(request),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    // Required for a refresh token; consent forces Google to re-issue one
    // even if the user granted access before.
    access_type: "offline",
    prompt: "consent",
    // Merge with previously granted scopes instead of replacing them.
    include_granted_scopes: "true",
    state: nonce,
  });
  if (user.email) params.set("login_hint", user.email);

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
