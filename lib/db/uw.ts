import "server-only";

import { avatarPublicUrl } from "@/lib/images/avatar-url";
import { createClient } from "@/lib/supabase/server";
import { UW } from "@/lib/flags";
import type { UwPeer } from "@/lib/uw";

// Suggested UW peers, from the uw_peers DEFINER RPC.
//
// Must be an RPC, for hydrateUsers' reason turned up a notch: `profiles` is
// owner-only, `public_profiles` deliberately carries none of the UW columns,
// and another UW student's goal rows are invisible under the friend-read
// policy. None of this is readable from the client at all — the cohort is
// visible only from inside the cohort, and uw_peers is the gate that decides
// that (a caller who isn't `is_uw` gets zero rows).

type UwPeerRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  uw_major: string | null;
  uw_clubs: string[] | null;
  goal_titles: string[] | null;
  same_major: boolean;
  shared_clubs: number;
  shared_goals: number;
};

function rowToUwPeer(row: UwPeerRow): UwPeer {
  return {
    userId: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: avatarPublicUrl(row.avatar_path),
    major: row.uw_major,
    clubs: row.uw_clubs ?? [],
    goalTitles: row.goal_titles ?? [],
    sameMajor: row.same_major === true,
    // Postgres returns int as a number here, but a count that arrives as a
    // string would silently make every matchReason() read "0 clubs" — the same
    // reason rowToGoal coerces weekly_quota_hours.
    sharedClubs: Number(row.shared_clubs) || 0,
    sharedGoals: Number(row.shared_goals) || 0,
  };
}

// NOT cache()-wrapped, unlike the rest of lib/db: this is called once per
// interaction from an action, not several times inside one render.
//
// `score` is dropped on the way out. It exists in SQL to order the list, and
// the client explains a match with matchReason(), never with a number.
export async function listUwPeers(limit = 20): Promise<UwPeer[]> {
  // The flag means "the SQL has run". Off, never name the RPC.
  if (!UW) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("uw_peers", { p_limit: limit });
  if (!data) return [];
  return (data as UwPeerRow[]).map(rowToUwPeer);
}
