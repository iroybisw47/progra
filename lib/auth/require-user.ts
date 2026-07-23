import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// The identity shape the app actually consumes — every call site uses only
// `.id` (and a few `.email`). Sourced from locally-verified JWT claims.
export type AuthedUser = { id: string; email: string | null };

// Cached per request — multiple callers during a single render (layout, page,
// data helpers, server actions) share one verification. getClaims verifies the
// JWT locally via Web Crypto (the project uses asymmetric signing keys), so
// unlike the previous auth.getUser() this costs no network round-trip; RLS
// remains the real authority on every query regardless.
export const getCurrentUser = cache(async (): Promise<AuthedUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getOptionalUser() {
  return getCurrentUser();
}
