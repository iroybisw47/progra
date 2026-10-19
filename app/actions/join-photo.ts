"use server";

import { revalidateJoinPhotoSurfaces } from "@/lib/revalidate";

import { getCurrentUser } from "@/lib/auth/require-user";
import { loadSharp } from "@/lib/images/sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeat } from "@/lib/auth/require-seat";
import { JOIN_PHOTO_BUCKET, joinPhotoPath } from "@/lib/join-photo";

type Result = { ok: true } | { error: string };

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 80;

// The photo on the current user's "just joined Progra" card, posted from
// onboarding's Screen 4 (the practice run). One per user, at {user_id}/join.jpg
// in the private join-photos bucket, replaced by a later post. Friends see it
// on the card listFriendJoins builds from onboarded_at (lib/db/feed.ts),
// through join_photos' row policy and the bucket's read policy, which both
// ask what recap posts ask (.claude/plans/join-photo.sql). Never throws to
// the client.
//
// Re-encoded with sharp first, as uploadSessionPhoto does, which strips every
// bit of EXIF/GPS before anything is stored.
export async function uploadJoinPhoto(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No photo provided." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "That file isn't an image." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Photo is too large (max 8 MB)." };
  }

  // Loaded per call: lib/images/sharp.ts says why.
  const loaded = await loadSharp();
  if ("error" in loaded) return { error: loaded.error };

  let output: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    output = await loaded
      .sharp(input)
      .rotate()
      .resize(MAX_EDGE_PX, MAX_EDGE_PX, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch {
    return { error: "Couldn't process that image." };
  }

  // The write goes through the service-role client, as uploadSessionPhoto's
  // does: Storage treats a user JWT as anon, so no INSERT policy can pass it.
  // The path is built from the verified user id alone, never from the
  // request, so this can only ever write the caller's own photo.
  const path = joinPhotoPath(user.id);
  const admin = createAdminClient();
  const bytes = new Uint8Array(output.byteLength);
  bytes.set(output);
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const { error: uploadError } = await admin.storage
    .from(JOIN_PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return { error: "Upload failed. Please try again." };

  // The row that points friends at it, under RLS (own row only).
  const { error: rowError } = await supabase
    .from("join_photos")
    .upsert(
      { user_id: user.id, photo_path: path, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (rowError) return { error: "Couldn't save the photo." };

  revalidateJoinPhotoSurfaces();
  return { ok: true };
}
