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
// Upsert on `token`, not on (user_id, token): the token identifies a physical
// install, so re-registering the same device must UPDATE its row rather than
// accumulate one per launch. `updated_at` doubles as a last-seen stamp, which is
// what lets a sender prune tokens APNs has stopped accepting.
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

  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: user.id,
      token: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );

  if (error) return { error: error.message };
  return { ok: true };
}
