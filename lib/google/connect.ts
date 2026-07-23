import "server-only";

import type { NextRequest } from "next/server";

// Shared pieces of the opt-in Google Calendar connect flow
// (/auth/google-calendar → Google → /auth/google-calendar/callback).

export const GCAL_STATE_COOKIE = "gcal_connect";

export type ConnectFrom = "onboarding" | "settings";

export function parseFrom(raw: string | null): ConnectFrom {
  return raw === "onboarding" ? "onboarding" : "settings";
}

// The public origin for redirects + the registered redirect_uri. Mirrors the
// x-forwarded-host handling in app/auth/callback/route.ts: behind Vercel's
// proxy the request origin is the internal host, so honor the forwarded host
// in production. Both handlers MUST derive the redirect_uri identically or the
// token exchange fails with redirect_uri_mismatch.
export function publicOrigin(request: NextRequest): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  return isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;
}

export function callbackUri(request: NextRequest): string {
  return `${publicOrigin(request)}/auth/google-calendar/callback`;
}

export function returnPath(from: ConnectFrom, ok: boolean): string {
  if (from === "onboarding") {
    return `/onboarding?step=calendar&status=${ok ? "connected" : "error"}`;
  }
  return `/settings?calendar=${ok ? "connected" : "error"}`;
}
