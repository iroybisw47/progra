import "server-only";

import { cache } from "react";

import type {
  ActivityDay,
  AnalyticsGoal,
  AnalyticsUser,
} from "@/lib/admin-analytics";
import { createClient } from "@/lib/supabase/server";

// Reads for /admin/analytics. Both RPCs are SECURITY DEFINER and re-check
// is_admin() as their first statement — that check, not the page gate, is what
// protects the data. Both return null on any error (including "function does
// not exist"), so the page can say the migration isn't installed rather than
// showing an empty roster that looks like "no users".

type GoalRow = {
  id: string;
  title: string | null;
  weekly_quota_hours: string | number;
  is_private: boolean;
  color: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  signed_up_at: string;
  username: string | null;
  display_name: string | null;
  seat_no: number | null;
  onboarded_on: string | null;
  local_today: string;
  last_seen_at: string | null;
  last_active_on: string | null;
  excluded: boolean;
  goals: GoalRow[] | null;
};

type ActivityRow = {
  user_id: string;
  day: string;
  tracked_min: number;
  habit_ticks: number;
};

function rowToAnalyticsGoal(row: GoalRow): AnalyticsGoal {
  return {
    id: row.id,
    title: row.title,
    // numeric column; jsonb emits a number, but normalize either way.
    weeklyQuotaHours: Number(row.weekly_quota_hours),
    isPrivate: row.is_private ?? false,
    color: row.color ?? null,
  };
}

function rowToAnalyticsUser(row: UserRow): AnalyticsUser {
  return {
    id: row.id,
    email: row.email,
    signedUpAt: row.signed_up_at,
    username: row.username,
    displayName: row.display_name,
    seatNo: row.seat_no,
    onboardedOn: row.onboarded_on,
    localToday: row.local_today,
    lastSeenAt: row.last_seen_at,
    lastActiveOn: row.last_active_on,
    excluded: row.excluded === true,
    goals: (row.goals ?? []).map(rowToAnalyticsGoal),
  };
}

function rowToActivityDay(row: ActivityRow): ActivityDay {
  return {
    userId: row.user_id,
    day: row.day,
    trackedMin: Number(row.tracked_min),
    habitTicks: Number(row.habit_ticks),
  };
}

export const listAnalyticsUsers = cache(
  async (): Promise<{ generatedAt: string; users: AnalyticsUser[] } | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error || !data) return null;
    const payload = data as { generated_at: string; users: UserRow[] | null };
    return {
      generatedAt: payload.generated_at,
      users: (payload.users ?? []).map(rowToAnalyticsUser),
    };
  }
);

// `weeks` rather than a start date so this can run in parallel with
// listAnalyticsUsers — a start date would have to wait for the roster's
// local_today. The SQL adds two days of slack to its window, which is what lets
// callers derive their own `since` from any user's local today and still be
// covered.
export const listActivityDays = cache(
  async (weeks: number): Promise<ActivityDay[] | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_activity_days", {
      p_weeks: weeks,
    });
    if (error) return null;
    return ((data ?? []) as ActivityRow[]).map(rowToActivityDay);
  }
);
