import "server-only";

import { getProfile } from "@/lib/auth/profile";
import { isWaitlisted } from "@/lib/auth/seat";

// Action-layer half of the 250-seat beta cap.
//
// The root layout already refuses to render the app for a seat-less user, but
// that only covers page loads: a valid JWT can POST a server action directly
// and never request a page at all. This closes that, and matters most for the
// outward-facing writes (comments, reactions, recaps, friend requests) where a
// waitlisted account could otherwise surface in someone else's feed.
//
// Returns rather than throws, per the repo's action contract, and mirrors
// requireAdmin() in app/actions/admin.ts. getProfile() is cache()'d and the
// layout re-renders in the same request, so this is effectively free.
export async function requireSeat(): Promise<{ ok: true } | { error: string }> {
  const profile = await getProfile();
  if (isWaitlisted(profile)) return { error: "Progra's beta is full." };
  return { ok: true };
}
