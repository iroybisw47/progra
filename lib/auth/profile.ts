import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

// The full profile row — INCLUDES live Google OAuth tokens. Server-only.
// NEVER pass a `Profile` to a client component or serialize it to the browser:
// use `toClientProfile()` (which structurally drops the token fields) for
// anything crossing the server/client boundary.
export type Profile = {
  id: string;
  timezone: string | null;
  google_provider_token: string | null;
  google_provider_refresh_token: string | null;
  google_token_expires_at: string | null;
  // The scope string Google granted at the opt-in calendar connect
  // (/auth/google-calendar). Null = never connected (or disconnected).
  google_scopes: string | null;
  // Null until the first-run onboarding flow is completed (or after a
  // "Replay onboarding" reset). Home redirects to /onboarding while null.
  onboarded_at: string | null;
  // Public identity (social v2). Null until the user claims a handle. `username`
  // is the URL-safe, unique handle; `display_name` and `bio` are free text.
  username: string | null;
  display_name: string | null;
  bio: string | null;
  // Blob path in the public `avatars` bucket (avatarPublicUrl derives the URL).
  avatar_path: string | null;
  // Nav-notification "last seen" stamps: the feed tab / friends tab clear their
  // dot by setting these to now. Null = never seen. (May be absent until the
  // column SQL is run — treated as null.)
  feed_seen_at: string | null;
  friend_requests_seen_at: string | null;
  // When the user last opened the Notifications panel (likes/comments on their
  // own sessions). Independent of friend_requests_seen_at so the like/comment dot
  // clears only on opening the panel, never on merely visiting Friends. Null =
  // never opened. (May be absent until the column SQL is run — treated as null.)
  notifications_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

// Cached per request alongside getCurrentUser so pages that need both
// (e.g. /habits' tz computation + layout's auth check) share one fetch.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return data;
});

// Token-free view of a profile, safe to hand to a client component. Structural
// omission (not just "don't select it") — the token fields can't be present on
// this type, so a leak becomes a compile error rather than a runtime accident.
export type ClientProfile = Omit<
  Profile,
  | "google_provider_token"
  | "google_provider_refresh_token"
  | "google_token_expires_at"
  | "google_scopes"
> & { calendarConnected: boolean };

export function toClientProfile(p: Profile): ClientProfile {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    google_provider_token,
    google_provider_refresh_token,
    google_token_expires_at,
    google_scopes,
    ...rest
  } = p;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return { ...rest, calendarConnected: isCalendarConnected(p) };
}

export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly";

// "Calendar connected" is a data predicate, never a stored boolean: a refresh
// token exists AND the granted scope string covers calendar events. Legacy
// grants (pre connect-flow) get google_scopes backfilled by SQL, so a null
// scope with a token means deliberately disconnected mid-migration — treat as
// not connected.
export function isCalendarConnected(profile: Profile | null): boolean {
  return (
    profile?.google_provider_refresh_token != null &&
    (profile.google_scopes ?? "").includes(CALENDAR_SCOPE)
  );
}
