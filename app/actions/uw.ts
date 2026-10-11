"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { listUwPeerGroups, listUwPeerPage } from "@/lib/db/uw";
import { UW } from "@/lib/flags";
import { revalidateIdentitySurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { uwProfilePayload, type UwProfileInput } from "@/lib/uw";
import {
  emptyUwPeerGroups,
  emptyUwPeerPage,
  isUwBucket,
  parseUwCursor,
  type UwBucket,
  type UwPeerCursor,
  type UwPeerGroups,
  type UwPeerPage,
} from "@/lib/uw-peers";

type Result = { ok: true } | { error: string };

// Join, update or leave the UW cohort. The only writer of the uw_* columns,
// and the only place their values are validated — the DB bounds size, not what
// lib/uw.ts considers valid. The join/leave rule itself is uwProfilePayload,
// pure and tested:
//
//   Join writes the cleaned majors and interests, the uw_listed opt-in, and
//   uw_share_goals = false (goal titles are no longer shared, plan D3), and
//   nulls v2's uw_major and uw_clubs.
//   Leave clears every UW field and sets uw_listed false.
//
// Used by onboarding v3's Screen 1 (P9c) and by the Settings block, which is
// why it takes the whole shape rather than one field: a student who already
// onboarded has no other way into the cohort.
export async function setUwProfile(input: UwProfileInput): Promise<Result> {
  if (!UW) return { error: "Not available yet." };
  const payload = uwProfilePayload(input);
  if (!payload) return { error: "Couldn't save your UW details." };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;

  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
  if (error) return { error: "Couldn't save your UW details." };

  revalidateIdentitySurfaces();
  return { ok: true };
}

// The viewer's three UW groups, first page of each.
//
// A READ in an action, which this codebase otherwise keeps in lib/db/* called
// from page.tsx. Same exception, and the same reason, as searchUsers in
// app/actions/friends.ts: Screen 5's groups depend on the majors and interests
// the student picked on Screen 1 of the same wizard, so there is no page render
// at which the answer is known. It writes nothing.
//
// No requireSeat, unlike setUwProfile: the RPC's own gate requires a seat and
// `is_uw` of the caller, and answers anyone else with no rows. A waitlisted
// caller learns nothing from an action that the database already refuses them.
export async function fetchUwPeerGroups(): Promise<
  { groups: UwPeerGroups } | { error: string }
> {
  if (!UW) return { groups: emptyUwPeerGroups() };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const groups = await listUwPeerGroups();
  if (!groups) return { error: "Couldn't load UW students right now." };
  return { groups };
}

// The next page of one group, after the cursor its previous page returned.
//
// The client sends back what an earlier call gave it, so both halves are
// checked before they reach the RPC: the bucket against the three names, the
// cursor as an ISO timestamp plus a UUID. The timestamp is forwarded as the
// same string, never reformatted (UwPeerCursor says why).
export async function fetchMoreUwPeers(
  bucket: UwBucket,
  cursor: UwPeerCursor
): Promise<{ page: UwPeerPage } | { error: string }> {
  if (!UW) return { page: emptyUwPeerPage() };
  const after = parseUwCursor(cursor);
  if (!isUwBucket(bucket) || !after) return { error: "Couldn't load more UW students." };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const page = await listUwPeerPage(bucket, after.ts, after.id);
  if (!page) return { error: "Couldn't load more UW students." };
  return { page };
}
