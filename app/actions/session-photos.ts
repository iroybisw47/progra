"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

const BUCKET = "session-photos";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 80;
// Upload tolerance for the "after" photo — NOT a product grace window. It only
// lets a slow upload / retry at clock-out still land. "After" means "taken at
// clock-out"; do not loosen this to allow adding photos to old sessions.
const AFTER_TOLERANCE_MS = 10 * 60 * 1000;

// Upload a before/after photo for one of the current user's sessions. Re-encodes
// with sharp (which strips all EXIF/GPS — the security point) before storing at
// {user_id}/{session_id}/{kind}.jpg in the private bucket, then records the path
// on the session. Never throws to the client.
export async function uploadSessionPhoto(
  sessionId: string,
  kind: "before" | "after",
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

  // Timing rules: before → session must still be active; after → session must
  // have ended within the tolerance window.
  if (kind === "before") {
    if (session.ended_at !== null) {
      return { error: "This session has already ended." };
    }
  } else {
    if (session.ended_at === null) {
      return { error: "This session hasn't ended yet." };
    }
    const endedMs = new Date(session.ended_at).getTime();
    if (Date.now() - endedMs > AFTER_TOLERANCE_MS) {
      return { error: "Too late to add an after photo." };
    }
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

  const path = `${user.id}/${sessionId}/${kind}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, output, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return { error: "Upload failed. Please try again." };

  const column = kind === "before" ? "before_photo_path" : "after_photo_path";
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ [column]: path })
    .eq("id", sessionId);
  if (updateError) return { error: "Couldn't save the photo." };

  revalidatePath("/clock");
  revalidatePath("/sessions");
  return { ok: true };
}
