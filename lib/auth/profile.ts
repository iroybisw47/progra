import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  timezone: string | null;
  google_provider_token: string | null;
  google_provider_refresh_token: string | null;
  google_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return data;
}
