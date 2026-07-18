import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client — SERVER ONLY. Bypasses RLS entirely, so it must
// never be imported into a client component and the key must never be exposed to
// the browser (it lives in SUPABASE_SERVICE_ROLE_KEY, not a NEXT_PUBLIC_ var).
//
// Used narrowly for the session-photo storage WRITE. This project's Storage
// service currently fails to authorize uploads from a valid user JWT (it treats
// authenticated tokens as anon at the storage layer, independent of the signing
// algorithm), so a normal user-scoped upload is rejected by the bucket's INSERT
// policy. The calling server action authenticates the user and verifies session
// ownership *before* using this client, so the authorization the storage RLS
// would have enforced is done explicitly in code.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
