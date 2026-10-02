"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { listUwPeers } from "@/lib/db/uw";
import { UW } from "@/lib/flags";
import { revalidateIdentitySurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { cleanClubs, cleanMajor, type UwPeer } from "@/lib/uw";

type Result = { ok: true } | { error: string };

// Join or update the UW cohort. The only writer of the four uw_* columns, and
// the only place their values are validated — the DB bounds length, not
// membership of the lists in lib/uw.ts.
//
// Used by BOTH onboarding's UW step and the Settings block, which is why it
// takes the whole shape rather than one field: a student who already onboarded
// has no other way into the cohort.
export async function setUwProfile(input: {
  isUw: boolean;
  major?: string | null;
  clubs?: string[] | null;
  shareGoals?: boolean;
}): Promise<Result> {
  if (!UW) return { error: "Not available yet." };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  // Leaving the cohort clears the fields with it. Keeping a stale major on a
  // profile that is no longer `is_uw` would leave data nothing can show and
  // nobody asked us to keep.
  const payload = input.isUw
    ? {
        is_uw: true,
        uw_major: cleanMajor(input.major),
        uw_clubs: cleanClubs(input.clubs),
        uw_share_goals: input.shareGoals !== false,
      }
    : { is_uw: false, uw_major: null, uw_clubs: [], uw_share_goals: true };

  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
  if (error) return { error: "Couldn't save your UW details." };

  revalidateIdentitySurfaces();
  return { ok: true };
}

// Suggested UW peers.
//
// A READ in an action, which this codebase otherwise keeps in lib/db/* called
// from page.tsx. Same exception, and the same reason, as searchUsers in
// app/actions/friends.ts: the input is something the user picks mid-flow — here
// their major and clubs — so there is no page render at which the answer is
// known. It writes nothing.
export async function fetchUwPeers(): Promise<{ peers: UwPeer[] }> {
  if (!UW) return { peers: [] };
  const user = await getCurrentUser();
  if (!user) return { peers: [] };
  // No requireSeat: this reads nothing a seatless user could act on, and the
  // RPC's own cohort gate already decides whether there is anything to return.
  return { peers: await listUwPeers() };
}
