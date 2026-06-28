"use server";

import { revalidatePath } from "next/cache";

import { listPrimaryCalendarEvents } from "@/lib/google/calendar";
import { GoogleAuthError, getValidGoogleAccessToken } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

type SyncResult = { ok: true; count: number } | { error: string };

const SYNC_WINDOW_PAST_DAYS = 30;
const SYNC_WINDOW_FUTURE_DAYS = 90;

export async function syncCalendar(): Promise<SyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let accessToken: string;
  try {
    accessToken = await getValidGoogleAccessToken(user.id);
  } catch (e) {
    if (e instanceof GoogleAuthError) return { error: e.message };
    return { error: "Failed to obtain Google access token" };
  }

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - SYNC_WINDOW_PAST_DAYS);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + SYNC_WINDOW_FUTURE_DAYS);

  let events;
  try {
    events = await listPrimaryCalendarEvents(accessToken, timeMin, timeMax);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Calendar fetch failed" };
  }

  // Skip cancelled events and all-day events (no dateTime, only date).
  // All-day events distort hour totals and aren't time-blocked work.
  const rows = events
    .filter((e) => e.status !== "cancelled")
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      user_id: user.id,
      google_event_id: e.id,
      calendar_id: "primary",
      title: e.summary ?? null,
      start_time: e.start!.dateTime!,
      end_time: e.end!.dateTime!,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { ok: true, count: 0 };

  const { error } = await supabase
    .from("calendar_events")
    .upsert(rows, { onConflict: "user_id,google_event_id" });

  if (error) return { error: error.message };
  revalidatePath("/clock");
  revalidatePath("/");
  return { ok: true, count: rows.length };
}
