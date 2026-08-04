"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

// Server-side cap (clients also cap; never trust the client). APNs device
// tokens are 64 hex chars and FCM's run ~163, so this is generous headroom
// without letting an arbitrary blob into the column.
const TOKEN_MAX = 512;

// Register this device for push. Called after @capacitor/push-notifications'
// `registration` event hands us an APNs token.
//
// Routed through the `save_device_token` SECURITY DEFINER RPC rather than a
// direct upsert, for one specific reason: a token identifies a physical device,
// so when a phone changes hands the previous account's row has to GO. Deleting
// it means writing a row owned by a different user, which owner-only RLS cannot
// do — otherwise their notifications keep arriving on a phone that isn't theirs.
// The RPC derives the caller from auth.uid() internally and takes no user id, so
// it can only ever act for whoever is calling. Same pattern as
// accept_friend_request / toggle_reaction.
//
// (The table's primary key is (user_id, token), so a plain upsert on `token`
// alone isn't even possible — it fails with 42P10, no matching constraint.)
//
// No revalidation — nothing in the UI renders device tokens. Mirrors the
// mark*Seen actions in app/actions/notifications.ts.
export async function saveDeviceToken(token: string): Promise<Result> {
  const trimmed = token.trim();
  if (!trimmed) return { error: "Token required" };
  if (trimmed.length > TOKEN_MAX) return { error: "Token too long" };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("save_device_token", {
    p_token: trimmed,
  });

  if (error) return { error: error.message };
  return { ok: true };
}
