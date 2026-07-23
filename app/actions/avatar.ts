"use server";

import sharp from "sharp";

import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import { revalidateIdentitySurfaces } from "@/lib/revalidate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

const BUCKET = "avatars";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const EDGE_PX = 512;
const JPEG_QUALITY = 80;

// Upload the current user's profile picture. Re-encodes with sharp (square
// crop; strips all EXIF/GPS — the same security boundary as session photos)
// and stores at {user_id}/avatar-{uuid}.jpg in the PUBLIC avatars bucket. The
// fresh filename per upload makes URLs immutable (browser-cacheable) and
// self-cache-busting; the previous blob is removed best-effort.
//
// The storage WRITE uses the admin client — Storage rejects user-JWT uploads
// as anon (same limitation uploadSessionPhoto documents). The path is derived
// ONLY from the session user's id, so no caller input can target another
// user's blob; the profiles write goes through the normal RLS client.
export async function uploadAvatar(formData: FormData): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

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

  let output: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    output = await sharp(input)
      .rotate()
      .resize(EDGE_PX, EDGE_PX, { fit: "cover" })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch {
    return { error: "Couldn't process that image." };
  }

  const previous = (await getProfile())?.avatar_path ?? null;
  const path = `${user.id}/avatar-${crypto.randomUUID()}.jpg`;

  const admin = createAdminClient();
  const bytes = new Uint8Array(output.byteLength);
  bytes.set(output);
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return { error: "Upload failed. Please try again." };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);
  if (updateError) return { error: "Couldn't save the photo." };

  // Old blob is orphaned now — remove it best-effort (hygiene, not exposure).
  if (previous && previous !== path) {
    try {
      await admin.storage.from(BUCKET).remove([previous]);
    } catch {
      // Ignore.
    }
  }

  revalidateIdentitySurfaces();
  return { ok: true };
}

// Clear the profile picture (back to initials) and drop the blob.
export async function removeAvatar(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const previous = (await getProfile())?.avatar_path ?? null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id);
  if (error) return { error: error.message };

  if (previous) {
    try {
      const admin = createAdminClient();
      await admin.storage.from(BUCKET).remove([previous]);
    } catch {
      // Best-effort.
    }
  }

  revalidateIdentitySurfaces();
  return { ok: true };
}
