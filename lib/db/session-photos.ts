import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/storage";

const BUCKET = "session-photos";
const SIGNED_URL_TTL_S = 60 * 60; // 1 hour

// Signed URL (1h) for a session's photo, or null when it has none / storage
// declined. The bucket is private; the storage policy (can_see_session_photo)
// only issues a URL when the caller owns the session, is an admin, or is an
// accepted friend and the session is finished and not private.
export async function getSessionPhotoUrl(
  session: Pick<Session, "photoPath">
): Promise<string | null> {
  const { photoPath } = session;
  if (!photoPath) return null;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, SIGNED_URL_TTL_S);
  return data?.signedUrl ?? null;
}

// Signed URLs (1h) for many sessions' photos in ONE round trip, keyed by storage
// path. getSessionPhotoUrl is per-session; a list calling it per row would issue
// a signing request per row. Empty set short-circuits, matching the hydrate*
// convention in lib/db/feed.ts.
//
// Storage RLS adjudicates each path separately, and createSignedUrls reports a
// refusal as a per-item error instead of failing the batch — so a path we may
// not read is simply absent from the map and the caller degrades to no photo.
// Keyed by the `path` each item echoes back rather than by array index: the two
// diverge the moment one item errors, which would otherwise hand a card someone
// else's photo.
export async function hydrateSessionPhotoUrls(
  paths: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_S);
  if (!data) return map;

  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}
