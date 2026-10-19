import "server-only";

import { JOIN_PHOTO_BUCKET } from "@/lib/join-photo";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_S = 60 * 60; // 1 hour

// User id → a signed URL (1h) for their "just joined Progra" photo, for the
// joins the feed is about to draw, in two round trips whatever their number.
// Both are gated: join_photos' RLS returns only the rows of people the viewer
// may see (as recap posts ask, .claude/plans/join-photo.sql), and Storage
// signs only what the bucket's read policy allows, reporting a refusal per
// item. Anything refused, missing, or a table not created yet comes back as no
// entry, and the card draws without a photo.
//
// Not cache()-wrapped, like hydrateSessionPhotoUrls: an array argument never
// hits React's per-request cache, and listFriendJoins calls it once.
export async function hydrateJoinPhotoUrls(userIds: string[]): Promise<Map<string, string>> {
  const byUser = new Map<string, string>();
  if (userIds.length === 0) return byUser;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("join_photos")
    .select("user_id, photo_path")
    .in("user_id", userIds);
  if (!rows || rows.length === 0) return byUser;

  const paths = (rows as { user_id: string; photo_path: string }[]).filter((r) => r.photo_path);
  if (paths.length === 0) return byUser;
  const { data: signed } = await supabase.storage
    .from(JOIN_PHOTO_BUCKET)
    .createSignedUrls(
      paths.map((r) => r.photo_path),
      SIGNED_URL_TTL_S
    );
  if (!signed) return byUser;

  // Keyed by the path each item echoes back, never by index: the two diverge
  // as soon as one item is refused.
  const urlByPath = new Map<string, string>();
  for (const item of signed) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }
  for (const r of paths) {
    const url = urlByPath.get(r.photo_path);
    if (url) byUser.set(r.user_id, url);
  }
  return byUser;
}
