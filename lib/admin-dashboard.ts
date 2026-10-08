// Types for the admin dashboard's data layer: what the admin_* RPCs in
// .claude/plans/analytics/phase4.sql return, and the filters they take. Pure
// (no I/O), shared by the readers in lib/db/admin-analytics.ts and the UI
// under app/admin/analytics/.
//
// The aggregate payloads keep the RPC's own snake_case keys on purpose — they
// are statistics, not row entities, and renaming forty keys buys nothing but
// a place for drift. The roster, which the UI sorts and filters as rows, gets
// a proper mapper (rowToRosterUser).

import type { UserState } from "@/lib/telemetry/metrics";

export type Segment = "uw" | "non_uw";

export type DashboardFilters = {
  includeInternal: boolean;
  segment: Segment | null;
  // Signup-date cohort, YYYY-MM-DD, inclusive.
  cohortFrom: string | null;
  cohortTo: string | null;
  // The "over time" window, YYYY-MM-DD, inclusive. Null = last 28 days.
  from: string | null;
  to: string | null;
};

export const EMPTY_FILTERS: DashboardFilters = {
  includeInternal: false,
  segment: null,
  cohortFrom: null,
  cohortTo: null,
  from: null,
  to: null,
};

// One row of analytics_user_facts(), as the RPC emits it.
export type RosterRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  tz: string;
  signed_up_at: string;
  signup_day: string;
  onboarded_at: string | null;
  segment: Segment;
  is_internal: boolean;
  excluded_reason: string | null;
  seat_no: number | null;
  provider: string;
  onboarding_step: string | null;
  onboarding_step_inferred: boolean;
  onboarding_step_at: string | null;
  notification_permission: string | null;
  reminder_prefs: Record<string, unknown> | null;
  social_pushes_enabled: boolean | null;
  nudges_enabled: boolean | null;
  last_opened_at: string | null;
  last_logged_at: string | null;
  first_logged_at: string | null;
  state: UserState;
  is_ghost: boolean;
  friend_count: number;
  friends_day7: number;
  logged_days_first7: number;
  is_activated: boolean;
  logged_weeks: number[];
  hours_7d: number | string;
  hours_prior_7d: number | string;
  clock_ins_7d: number;
  habit_checks_7d: number;
  days_opened_7d: number;
  opens_7d: number;
  likes_given_7d: number;
  comments_given_7d: number;
  views_given_7d: number;
  nudges_given_7d: number;
  likes_received_7d: number;
  comments_received_7d: number;
  views_received_7d: number;
  nudges_received_7d: number;
  notifications_received_7d: number;
  notifications_opened_7d: number;
  ever_clocked: boolean;
  ever_habit: boolean;
  clocked_7d: boolean;
  habit_7d: boolean;
  active_week4: boolean;
  has_goal: boolean;
  has_habit: boolean;
};

export type RosterUser = {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  signedUpAt: string;
  onboardedAt: string | null;
  segment: Segment;
  isInternal: boolean;
  excludedReason: string | null;
  seatNo: number | null;
  provider: string;
  onboardingStep: string | null;
  onboardingStepInferred: boolean;
  notificationPermission: string | null;
  lastOpenedAt: string | null;
  lastLoggedAt: string | null;
  state: UserState;
  isGhost: boolean;
  friendCount: number;
  friendsDay7: number;
  isActivated: boolean;
  hoursThisWeek: number;
  clockIns7d: number;
  habitChecks7d: number;
  daysOpened7d: number;
  opens7d: number;
  interactionsGiven7d: number;
  interactionsReceived7d: number;
  notificationsReceived7d: number;
  notificationsOpened7d: number;
};

export function rowToRosterUser(r: RosterRow): RosterUser {
  return {
    id: r.id,
    email: r.email,
    username: r.username,
    displayName: r.display_name,
    signedUpAt: r.signed_up_at,
    onboardedAt: r.onboarded_at,
    segment: r.segment,
    isInternal: r.is_internal,
    excludedReason: r.excluded_reason,
    seatNo: r.seat_no,
    provider: r.provider,
    onboardingStep: r.onboarding_step,
    onboardingStepInferred: r.onboarding_step_inferred,
    notificationPermission: r.notification_permission,
    lastOpenedAt: r.last_opened_at,
    lastLoggedAt: r.last_logged_at,
    state: r.state,
    isGhost: r.is_ghost,
    friendCount: r.friend_count,
    friendsDay7: r.friends_day7,
    isActivated: r.is_activated,
    hoursThisWeek: Number(r.hours_7d),
    clockIns7d: r.clock_ins_7d,
    habitChecks7d: r.habit_checks_7d,
    daysOpened7d: r.days_opened_7d,
    opens7d: r.opens_7d,
    interactionsGiven7d:
      r.likes_given_7d + r.comments_given_7d + r.views_given_7d + r.nudges_given_7d,
    interactionsReceived7d:
      r.likes_received_7d + r.comments_received_7d + r.views_received_7d + r.nudges_received_7d,
    notificationsReceived7d: r.notifications_received_7d,
    notificationsOpened7d: r.notifications_opened_7d,
  };
}

export type Roster = { generatedAt: string; users: RosterUser[] };

export type Ratio = { n: number; m: number };

export type Pulse = {
  users: number;
  not_onboarded: number;
  never_logged: number;
  active: number;
  lapsed: number;
  ghosts: number;
  activated: number;
  activation_eligible: number;
  median_friends_doers: number | null;
  median_friends_ghosts: number | null;
  hours_7d: number | string | null;
  hours_prior_7d?: number | string | null;
};

export type Funnel = {
  signed_up: number;
  onboarded: number;
  one_friend: number;
  first_log: number;
  three_friends: number;
  activated: number;
  active_week4: number;
  week4_eligible: number;
};

export type RetentionRow = {
  week_of: string;
  split: "<3" | "3+";
  n: number;
  weeks: (Ratio | null)[];
};

export type Overview = {
  generated_at: string;
  now: Pulse;
  prior: Pulse;
  funnel: Funnel;
  retention: RetentionRow[];
};

export type UsageSocial = {
  generated_at: string;
  from: string;
  to: string;
  usage_mix: {
    active: number;
    clock_only: number;
    habits_only: number;
    both: number;
    ever_clock_only: number;
    ever_habits_only: number;
    ever_both: number;
    ever_neither: number;
  };
  session_quality: {
    sessions: number;
    doers: number;
    sessions_per_doer: number | string | null;
    median_session_min: number | string | null;
    pct_auto_ended: number | string | null;
    logged_hours_7d: number | string | null;
    target_hours: number | string | null;
  };
  series: { day: string; clock_ins: number; habit_checks: number; active_users: number }[];
  goals_by_category: {
    category: string;
    goals: number;
    users: number;
    pct_ever_logged: number | string;
    hours_7d: number | string;
    week4_retention: Ratio | null;
  }[];
  friend_buckets: { bucket: string; users: number; active: number }[];
  interactions: {
    likes: number;
    comments: number;
    profile_views: number;
    nudges: number;
    active_users: number;
    per_active_user: number | string | null;
  };
  nudges: { sent: number; opened: number; converted: number; baseline_pct: number | string | null };
  social_pull: {
    after_friend: number;
    sessions_with_friends: number;
    after_friend_baseline_pct: number | string | null;
    returned_after_social: number;
    social_events: number;
    quiet_users: number;
    quiet_daily_open_pct: number | string | null;
  };
  collecting_data: boolean;
};

export type NotificationStats = {
  generated_at: string;
  from: string;
  to: string;
  by_type: {
    type: string;
    channel: "local" | "remote";
    sent: number;
    tapped: number;
    influenced: number;
    converted: number;
    baseline_pct: number | string | null;
    lift_pct: number | string | null;
  }[];
  by_hour: { hour: number; sent: number; tapped: number; converted: number; baseline_pct: number | string | null }[];
  fatigue: { per_day: string; sent: number; tapped: number; converted: number }[];
  by_state: { state: UserState; ghost: boolean; sent: number; tapped: number; converted: number }[];
  permission: { permission: string; users: number }[];
  toggles: {
    users: number;
    social_pushes_off: number;
    nudges_off: number;
    clock_reminders_off: number;
    habit_reminder_off: number;
    prefs_reported: number;
  };
  collecting_data: boolean;
};

export type OnboardingStats = {
  generated_at: string;
  steps: { step: string; provider: string; reached: number; stuck: number; median_seconds: number | string | null }[];
  stuck_users: {
    id: string;
    username: string | null;
    display_name: string | null;
    provider: string;
    step: string | null;
    inferred: boolean;
    signed_up_at: string;
    last_opened_at: string | null;
  }[];
  duplicates: {
    display_name: string;
    users: { id: string; username: string | null; provider: string; email: string | null; signed_up_at: string; state: UserState }[];
  }[];
};

export type GhostCompare = {
  n: number;
  median_friends: number | null;
  median_opens_7d: number | null;
  pct_permission_granted: number | string | null;
  pct_with_goal: number | string | null;
  pct_with_habit: number | string | null;
};

export type GhostBehavior = {
  generated_at: string;
  sessions: {
    app_sessions: number;
    ghosts_seen: number;
    feed_viewed: number;
    profile_view: number;
    like_or_comment: number;
    clock_screen_no_start: number;
    session_cancelled: number;
    goal_edit: number;
    bounced_10s: number;
  };
  frequency: {
    ghosts: number;
    avg_opens_7d: number | string | null;
    avg_days_opened_7d: number | string | null;
    buckets: Record<"1" | "2-3" | "4-6" | "7+", number>;
  };
  compare: { ghosts: GhostCompare; doers: GhostCompare };
};

export type TimelineEntry = { at: string; kind: string; meta: Record<string, unknown> };

// A number the RPC may have serialised as a numeric string.
export function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function pct(n: number, m: number): number | null {
  return m === 0 ? null : Math.round((100 * n) / m);
}
