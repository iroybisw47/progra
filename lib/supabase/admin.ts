import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client — SERVER ONLY. Bypasses RLS entirely, so it must
// never be imported into a client component and the key must never be exposed to
// the browser (it lives in SUPABASE_SERVICE_ROLE_KEY, not a NEXT_PUBLIC_ var).
//
// TWO narrow uses, each with the same discipline — the caller authenticates
// and authorizes BEFORE this client touches anything, so the check RLS would
// have made is done explicitly in code:
//
// 1. The session-photo storage WRITE (uploadSessionPhoto). This project's
//    Storage service fails to authorize uploads from a valid user JWT (it
//    treats authenticated tokens as anon at the storage layer, independent of
//    the signing algorithm), so a normal user-scoped upload is rejected by the
//    bucket's INSERT policy. The action verifies session ownership first.
// 2. The social-push sender (lib/push/send-social-push.ts). It reads the
//    RECIPIENT's device tokens and opt-out — owner-only rows, and the
//    recipient is precisely not the caller. It runs only inside after() from
//    an action whose like/comment write already succeeded under RLS, which is
//    the proof the actor may see that session.
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
