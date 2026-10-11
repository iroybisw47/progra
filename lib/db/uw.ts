import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { UW } from "@/lib/flags";
import {
  UW_PEER_FETCH,
  buildUwPeerGroups,
  emptyUwPeerGroups,
  emptyUwPeerPage,
  uwPeerPage,
  type UwBucket,
  type UwPeerGroups,
  type UwPeerPage,
  type UwPeerRow,
} from "@/lib/uw-peers";

// The viewer's UW groups, from the list_uw_peers DEFINER RPC
// (uw-cohort.sql STEP 5).
//
// Must be an RPC: `profiles` is owner-only, and `public_profiles` deliberately
// carries none of the UW columns, so another student's majors and interests
// are readable from nowhere else. The cohort is visible only from inside it,
// and list_uw_peers is the gate that decides that: a caller who isn't `is_uw`,
// or has no seat, gets zero rows, and anyone who hasn't opted in with
// `uw_listed` is in no group at all (plan D2).
//
// Both reads return null when the RPC failed, which is not the same answer as
// "nobody yet": Screen 5 says "You're early" for an empty result, and must not
// say it because a request broke. With UW off they return the empty answer
// without naming the RPC — the flag means "STEP 5 has run" (lib/flags.ts).
//
// The rows' shaping (the off-list major filter, cursors, the bucket split) is
// lib/uw-peers.ts, where it is tested.

// The first page of every group. cache()-wrapped like the rest of lib/db, so a
// page and its layout that both ask share one call.
export const listUwPeerGroups = cache(async (): Promise<UwPeerGroups | null> => {
  if (!UW) return emptyUwPeerGroups();
  const supabase = await createClient();
  // p_bucket left at its null default: one page of each bucket, in one call.
  const { data, error } = await supabase.rpc("list_uw_peers", {
    p_limit: UW_PEER_FETCH,
  });
  if (error || !Array.isArray(data)) return null;
  return buildUwPeerGroups(data as UwPeerRow[]);
});

// The page of one group after a cursor ("More at UW"'s infinite scroll, or a
// long match group). Primitive arguments rather than a cursor object, because
// cache() compares arguments by identity. The caller has validated all three
// (app/actions/uw.ts, parseUwCursor) before they get here.
export const listUwPeerPage = cache(
  async (bucket: UwBucket, afterTs: string, afterId: string): Promise<UwPeerPage | null> => {
    if (!UW) return emptyUwPeerPage();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_uw_peers", {
      p_bucket: bucket,
      p_limit: UW_PEER_FETCH,
      p_after_ts: afterTs,
      p_after_id: afterId,
    });
    if (error || !Array.isArray(data)) return null;
    return uwPeerPage(data as UwPeerRow[], bucket);
  }
);
