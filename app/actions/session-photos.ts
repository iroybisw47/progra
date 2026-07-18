"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { error: string };

const BUCKET = "session-photos";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 80;

// Upload the photo for one of the current user's sessions. Re-encodes with sharp
// (which strips all EXIF/GPS — the security point) before storing at
// {user_id}/{session_id}/photo.jpg in the private bucket, then records the path
// on the session. Never throws to the client.
//
// A session carries at most one photo, taken while it runs. Who may see it is
// decided by the session's is_private flag alone (storage policy
// can_see_session_photo), never by anything about the photo itself.
export async function uploadSessionPhoto(
  sessionId: string,
  formData: FormData
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Validate the incoming file cheaply before touching storage.
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

  // Fetch the session. RLS also grants friend reads now, so owner-only isn't
  // implied by a non-empty result — enforce ownership explicitly.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, ended_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.user_id !== user.id) {
    return { error: "Session not found." };
  }

  // The photo is taken during the session, so the session must still be running.
  // This also keeps the capture window inside the period where the photo is
  // unreachable to friends (can_see_session_photo requires ended_at is not null),
  // so nothing is exposed before the finish screen asks about privacy.
  if (session.ended_at !== null) {
    return { error: "This session has already ended." };
  }

  // Re-encode: rotate() bakes EXIF orientation into pixels, resize caps the
  // longest edge (never enlarges), jpeg() drops all remaining metadata. We never
  // upload the original bytes.
  let output: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    output = await sharp(input)
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

  const path = `${user.id}/${sessionId}/photo.jpg`;
  // The storage WRITE goes through a service-role client, not the user-scoped
  // one. This project's Storage service does not authorize uploads from a valid
  // user JWT (it treats authenticated tokens as anon at the storage layer, so
  // the bucket's INSERT policy rejects them). Ownership was already verified
  // above, so this write is safe — the admin client just bypasses the RLS that
  // can't currently be satisfied. Upload a Blob (not the raw Buffer): that is the
  // path verified to store intact JPEG bytes. Reads still use signed URLs and
  // need no change.
  const admin = createAdminClient();
  // Copy into an ArrayBuffer-backed Uint8Array so it's a valid BlobPart (a Node
  // Buffer's backing store is typed as possibly-SharedArrayBuffer).
  const bytes = new Uint8Array(output.byteLength);
  bytes.set(output);
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return { error: "Upload failed. Please try again." };

  const { error: updateError } = await supabase
    .from("sessions")
    .update({ photo_path: path })
    .eq("id", sessionId);
  if (updateError) return { error: "Couldn't save the photo." };

  revalidatePath("/clock");
  revalidatePath("/sessions");
  return { ok: true };
}
