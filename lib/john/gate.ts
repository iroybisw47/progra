import "server-only";

import { getProfile } from "@/lib/auth/profile";
import { isJohnUser } from "@/lib/john/cohort";

// The cohort check for server actions. Pages compute the same thing from the
// getProfile() they already await and pass it down as a `john` prop — this is
// for the write side, where there is no page to inherit from.
//
// COST: getProfile() is cache()-wrapped per request, and a server action is its
// own request, so this is one extra round-trip. Call it ONLY when the caller has
// actually sent a John field — a non-cohort client never does, because the UI
// that produces them is gated, so the other ~50 users pay nothing on clock-in or
// clock-out. Never hoist it to the top of an action.
export async function isJohnRequest(): Promise<boolean> {
  return isJohnUser(await getProfile());
}
