import "server-only";

import { cache } from "react";

import {
  rowToRosterUser,
  type DashboardFilters,
  type GhostBehavior,
  type NotificationStats,
  type OnboardingStats,
  type Overview,
  type Roster,
  type RosterRow,
  type TimelineEntry,
  type UsageSocial,
} from "@/lib/admin-dashboard";
import { createClient } from "@/lib/supabase/server";

// Reads for /admin/analytics.
//
// One cache()-wrapped reader per admin_* RPC (phase4.sql). Every RPC
// re-checks is_admin() as its first statement — that, not the page gate, is
// what protects the data. All return null on any error, including "function
// does not exist", so the page can say the SQL hasn't been run rather than
// render an empty dashboard that looks like "no users".
//
// Primitive args only (the cache() rule): the filters object is spread into
// scalars at the call site by the page.

type FilterArgs = {
  p_include_internal: boolean;
  p_segment: string | null;
  p_cohort_from: string | null;
  p_cohort_to: string | null;
};

function filterArgs(
  includeInternal: boolean,
  segment: string | null,
  cohortFrom: string | null,
  cohortTo: string | null
): FilterArgs {
  return {
    p_include_internal: includeInternal,
    p_segment: segment,
    p_cohort_from: cohortFrom,
    p_cohort_to: cohortTo,
  };
}

export function filtersToArgs(f: DashboardFilters): [boolean, string | null, string | null, string | null] {
  return [f.includeInternal, f.segment, f.cohortFrom, f.cohortTo];
}

export const getAdminRoster = cache(
  async (
    includeInternal: boolean,
    segment: string | null,
    cohortFrom: string | null,
    cohortTo: string | null
  ): Promise<Roster | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "admin_user_roster",
      filterArgs(includeInternal, segment, cohortFrom, cohortTo)
    );
    if (error || !data) return null;
    const payload = data as { generated_at: string; users: RosterRow[] | null };
    return {
      generatedAt: payload.generated_at,
      users: (payload.users ?? []).map(rowToRosterUser),
    };
  }
);

export const getAdminOverview = cache(
  async (
    includeInternal: boolean,
    segment: string | null,
    cohortFrom: string | null,
    cohortTo: string | null
  ): Promise<Overview | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "admin_overview",
      filterArgs(includeInternal, segment, cohortFrom, cohortTo)
    );
    if (error || !data) return null;
    return data as Overview;
  }
);

export const getAdminUsageSocial = cache(
  async (
    includeInternal: boolean,
    segment: string | null,
    cohortFrom: string | null,
    cohortTo: string | null,
    from: string | null,
    to: string | null
  ): Promise<UsageSocial | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_usage_social", {
      ...filterArgs(includeInternal, segment, cohortFrom, cohortTo),
      p_from: from,
      p_to: to,
    });
    if (error || !data) return null;
    return data as UsageSocial;
  }
);

export const getAdminNotificationStats = cache(
  async (
    includeInternal: boolean,
    segment: string | null,
    cohortFrom: string | null,
    cohortTo: string | null,
    from: string | null,
    to: string | null
  ): Promise<NotificationStats | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_notification_stats", {
      ...filterArgs(includeInternal, segment, cohortFrom, cohortTo),
      p_from: from,
      p_to: to,
    });
    if (error || !data) return null;
    return data as NotificationStats;
  }
);

export const getAdminOnboardingStats = cache(
  async (
    includeInternal: boolean,
    segment: string | null,
    cohortFrom: string | null,
    cohortTo: string | null
  ): Promise<OnboardingStats | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "admin_onboarding_stats",
      filterArgs(includeInternal, segment, cohortFrom, cohortTo)
    );
    if (error || !data) return null;
    return data as OnboardingStats;
  }
);

export const getAdminGhostBehavior = cache(
  async (
    includeInternal: boolean,
    segment: string | null,
    cohortFrom: string | null,
    cohortTo: string | null
  ): Promise<GhostBehavior | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "admin_ghost_behavior",
      filterArgs(includeInternal, segment, cohortFrom, cohortTo)
    );
    if (error || !data) return null;
    return data as GhostBehavior;
  }
);

export const getAdminUserTimeline = cache(
  async (userId: string, limit: number): Promise<TimelineEntry[] | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_user_timeline", {
      p_user: userId,
      p_limit: limit,
    });
    if (error) return null;
    return ((data ?? []) as TimelineEntry[]).map((e) => ({
      at: e.at,
      kind: e.kind,
      meta: (e.meta ?? {}) as Record<string, unknown>,
    }));
  }
);
