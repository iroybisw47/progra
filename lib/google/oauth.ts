import "server-only";

import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

type RefreshResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
};

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public reason: "no_refresh_token" | "refresh_failed" | "no_profile" = "refresh_failed"
  ) {
    super(message);
  }
}

// Returns a Google access token guaranteed valid for at least the next minute.
// Refreshes via the stored refresh token if expired, and persists the new
// access token + expiry back to profiles.
export async function getValidGoogleAccessToken(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "google_provider_token, google_provider_refresh_token, google_token_expires_at"
    )
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new GoogleAuthError("Profile not found", "no_profile");
  }

  const now = Date.now();
  const expiresAt = profile.google_token_expires_at
    ? new Date(profile.google_token_expires_at).getTime()
    : 0;

  if (profile.google_provider_token && expiresAt > now + 60_000) {
    return profile.google_provider_token;
  }

  if (!profile.google_provider_refresh_token) {
    throw new GoogleAuthError(
      "Google Calendar isn't connected. Connect it in Settings.",
      "no_refresh_token"
    );
  }

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: profile.google_provider_refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    // A revoked/expired grant can never succeed again — self-heal by clearing
    // the stored tokens + scope so every surface falls back to the clean
    // "not connected" state (reconnect from Settings) instead of erroring
    // forever on each sync attempt.
    if (res.status === 400 && text.includes("invalid_grant")) {
      await supabase
        .from("profiles")
        .update({
          google_provider_token: null,
          google_provider_refresh_token: null,
          google_token_expires_at: null,
          google_scopes: null,
        })
        .eq("id", userId);
      throw new GoogleAuthError(
        "Google Calendar access was revoked. Reconnect it in Settings.",
        "refresh_failed"
      );
    }
    throw new GoogleAuthError(
      `Google token refresh failed (${res.status}): ${text}`,
      "refresh_failed"
    );
  }

  const tokens = (await res.json()) as RefreshResponse;
  const newExpiresAt = new Date(
    Date.now() + (tokens.expires_in - 60) * 1000
  ).toISOString();

  await supabase
    .from("profiles")
    .update({
      google_provider_token: tokens.access_token,
      google_token_expires_at: newExpiresAt,
    })
    .eq("id", userId);

  return tokens.access_token;
}
