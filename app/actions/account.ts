"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

const BUCKET = "session-photos";

// Permanently delete the signed-in user's account: their photo blobs, then all
// their rows (via the delete_own_account definer RPC, which reads auth.uid()
// internally so it can only ever delete the caller), then sign them out. Order
// matters — the blobs are removed first, while the session rows still exist to
// tell us the object paths.
export async function deleteAccount(): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  // Collect this user's photo object paths and remove the blobs. The own-object
  // storage policy permits these deletes. Best-effort: a storage hiccup here
  // shouldn't block account deletion (orphaned blobs are hygiene, not exposure).
  const { data: photoRows } = await supabase
    .from("sessions")
    .select("photo_path")
    .eq("user_id", user.id);
  const paths = (photoRows ?? [])
    .map((r) => r.photo_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: "Couldn't delete your account. Please try again." };

  // The account row is gone; drop the auth cookies so the app treats them as
  // signed out on the next request.
  await supabase.auth.signOut();
  return { ok: true };
}
