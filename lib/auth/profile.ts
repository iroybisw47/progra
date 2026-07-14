import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  timezone: string | null;
  google_provider_token: string | null;
  google_provider_refresh_token: string | null;
  google_token_expires_at: string | null;
  // Null until the first-run onboarding flow is completed (or after a
  // "Replay onboarding" reset). Home redirects to /onboarding while null.
  onboarded_at: string | null;
  // Public identity (social v2). Null until the user claims a handle. `username`
  // is the URL-safe, unique handle; `display_name` and `bio` are free text.
  username: string | null;
  display_name: string | null;
  bio: string | null;
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
