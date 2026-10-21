"use server";

import { getCurrentUser } from "@/lib/auth/require-user";
import { STREAKS } from "@/lib/flags";
import { revalidateStreakSurfaces } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

// Streak writes (.claude/plans/streaks.md). Neither takes a user id: the RPC
// and the update are both scoped to auth.uid(), and the database decides
// everything else.

// Writes your closed days into the ledger, which is what makes them final
// (streak_settle). Fired by EnsureStreakSettled only when the read says there
// are unsettled days, so a normal load costs nothing. Settling never changes a
// number on screen, but `unsettled` changes, so the surfaces re-read it.
export async function settleMyStreak(): Promise<
  { ok: true; settled: number } | { error: string }
> {
  if (!STREAKS) return { error: "Not available" };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("settle_my_streak");
  if (error) return { error: "Couldn't save that." };
  const settled = typeof data === "number" ? data : 0;
  if (settled > 0) revalidateStreakSurfaces();
  return { ok: true, settled };
}

// The announcement card's ✕. No requireSeat(), like the other seen-stamps: a
// waitlisted user never gets the app shell.
export async function dismissStreakAnnouncement(): Promise<
  { ok: true } | { error: string }
> {
  if (!STREAKS) return { error: "Not available" };
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ streak_announcement_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save that." };
  revalidateStreakSurfaces();
  return { ok: true };
}
