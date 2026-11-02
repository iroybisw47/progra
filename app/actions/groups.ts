"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { requireSeat } from "@/lib/auth/require-seat";
import { GROUPS } from "@/lib/flags";
import { revalidateGroupSurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

type Result = { ok: true } | { error: string };

// Join a group: join_group (.claude/plans/groups.sql) checks the cap under a
// lock and friends you with every member it may — not anyone blocked either
// way, not a pair one of you unfriended. Returns how many new friends that
// made. A full group gets its own sentence, matched on the definer's fixed
// 'group full' (the cap is the one refusal worth explaining); every other
// failure gets the generic one, as everywhere else. The seat check is here for
// the message; the RPC refuses a waitlisted caller on its own.
export async function joinGroup(
  groupId: string
): Promise<{ ok: true; newFriends: number } | { error: string }> {
  if (!GROUPS) return { error: "Couldn't join that group." };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const seat = await requireSeat();
  if ("error" in seat) return seat;
  if (!isUuid(groupId)) return { error: "Couldn't join that group." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_group", { p_group: groupId });
  if (error) {
    return { error: /group full/.test(error.message) ? "That group is full." : "Couldn't join that group." };
  }
  revalidateGroupSurfaces();
  return { ok: true, newFriends: typeof data === "number" ? data : 0 };
}

// Leave a group. Ends each group friendship no other shared group still
// backs; manual friendships, and every other group's, stay. Never marks
// anyone unfriended, so rejoining friends you again. Leaving a group you
// aren't in is a no-op, not an error.
export async function leaveGroup(groupId: string): Promise<Result> {
  if (!GROUPS) return { error: "Couldn't leave that group." };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(groupId)) return { error: "Couldn't leave that group." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", { p_group: groupId });
  if (error) return { error: "Couldn't leave that group." };
  revalidateGroupSurfaces();
  return { ok: true };
}
