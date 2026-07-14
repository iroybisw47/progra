import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/storage";

const BUCKET = "session-photos";
const SIGNED_URL_TTL_S = 60 * 60; // 1 hour

export type SessionPhotoUrls = {
  before: string | null;
  after: string | null;
};

// Signed URLs (1h) for whichever of a session's before/after photos exist. The
// bucket is private; storage RLS only issues a URL when the caller owns the
// object or is an accepted friend of its owner. Batches with createSignedUrls
// when both photos are present.
export async function getSessionPhotoUrls(
  session: Pick<Session, "beforePhotoPath" | "afterPhotoPath">
): Promise<SessionPhotoUrls> {
  const { beforePhotoPath, afterPhotoPath } = session;
  if (!beforePhotoPath && !afterPhotoPath) return { before: null, after: null };

  const supabase = await createClient();
  const storage = supabase.storage.from(BUCKET);

  if (beforePhotoPath && afterPhotoPath) {
    const { data } = await storage.createSignedUrls(
      [beforePhotoPath, afterPhotoPath],
      SIGNED_URL_TTL_S
    );
    return {
      before: data?.[0]?.signedUrl ?? null,
      after: data?.[1]?.signedUrl ?? null,
    };
  }

  const path = (beforePhotoPath ?? afterPhotoPath) as string;
  const { data } = await storage.createSignedUrl(path, SIGNED_URL_TTL_S);
  const url = data?.signedUrl ?? null;
  return {
    before: beforePhotoPath ? url : null,
    after: afterPhotoPath ? url : null,
  };
}
