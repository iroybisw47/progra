// Streaks: what the surfaces show, decided from the RPCs' answers. Pure and
// client-safe, so the badge, the sheet and the announcement card all agree, and
// every rule here is a unit test (lib/streaks-view.test.ts).

import {
  FREEZES_PER_MONTH,
  FRIEND_STREAK_MIN,
  STREAK_MILESTONES,
} from "@/lib/streaks-config";

// get_my_streak(), mapped. Pre-launch carries no numbers at all.
export type MyStreak =
  | { state: "prelaunch"; launch: string | null }
  | {
      state: "live";
      launch: string;
      today: string;
      current: number;
      longest: number;
      atRisk: boolean;
      todayActive: boolean;
      freezesLeft: number;
      freezeDays: string[];
      milestone: number | null;
      unsettled: number;
    };

// get_friend_streak(), mapped: their shared-only count. Never freezes.
export type FriendStreak =
  | { state: "prelaunch"; launch: string | null }
  | { state: "live"; launch: string; current: number; longest: number };

const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const int = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

// Anything malformed reads as null (no badge, no card) rather than a wrong
// number: the RPC is the authority, and a missing badge costs nothing.
export function rowToMyStreak(data: unknown): MyStreak | null {
  if (data === null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.state === "prelaunch") {
    return { state: "prelaunch", launch: isDate(d.launch) ? d.launch : null };
  }
  if (d.state !== "live" || !isDate(d.launch) || !isDate(d.today)) return null;
  const milestone = typeof d.milestone === "number" ? d.milestone : null;
  return {
    state: "live",
    launch: d.launch,
    today: d.today,
    current: int(d.current),
    longest: int(d.longest),
    atRisk: d.at_risk === true,
    todayActive: d.today_active === true,
    freezesLeft: Math.min(FREEZES_PER_MONTH, int(d.freezes_left)),
    freezeDays: Array.isArray(d.freeze_days) ? d.freeze_days.filter(isDate) : [],
    milestone: (STREAK_MILESTONES as readonly number[]).includes(milestone ?? -1) ? milestone : null,
    unsettled: int(d.unsettled),
  };
}

export function rowToFriendStreak(data: unknown): FriendStreak | null {
  if (data === null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.state === "prelaunch") {
    return { state: "prelaunch", launch: isDate(d.launch) ? d.launch : null };
  }
  if (d.state !== "live" || !isDate(d.launch)) return null;
  return { state: "live", launch: d.launch, current: int(d.current), longest: int(d.longest) };
}

export type BadgeView = {
  count: number;
  // Dimmed while today hasn't counted yet: a nudge, not an alarm.
  dim: boolean;
  milestone: number | null;
};

// Your own badge: from 1 day, dimmed while at risk, gone at 0 (no guilt).
export function myBadge(s: MyStreak | null): BadgeView | null {
  if (!s || s.state !== "live" || s.current < 1) return null;
  return { count: s.current, dim: s.atRisk, milestone: s.milestone };
}

// A friend's badge: from FRIEND_STREAK_MIN days, never dimmed (their today is
// theirs), milestones from their shared count.
export function friendBadge(s: FriendStreak | null): BadgeView | null {
  if (!s || s.state !== "live" || s.current < FRIEND_STREAK_MIN) return null;
  let milestone: number | null = null;
  for (const m of STREAK_MILESTONES) if (s.current >= m) milestone = m;
  return { count: s.current, dim: false, milestone };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "2 of 2 freezes left in October" — the month of the user's own today.
export function freezesLine(freezesLeft: number, today: string): string {
  const month = MONTHS[Number(today.slice(5, 7)) - 1] ?? "";
  return `${freezesLeft} of ${FREEZES_PER_MONTH} freezes left in ${month}`;
}

// "Wednesday, October 21" for a YYYY-MM-DD, read as a plain calendar date.
export function launchLabel(launch: string): string {
  const [y, m, d] = launch.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${MONTHS[m - 1]} ${d}`;
}

export const ANNOUNCEMENT_PLACEHOLDER = "[ANNOUNCEMENT COPY]";

export type AnnouncementView =
  | { phase: "prelaunch"; when: string | null }
  | { phase: "launched" };

// The announcement card. Before launch it stays up until dismissed. On or
// after Day One it shows once more, for anyone who hasn't dismissed it since
// launch (a pre-launch dismissal doesn't count, so everyone hears it started).
// `seenDay` is the streak day the dismissal fell on, in the user's timezone.
//
// Placeholder copy never reaches a production render: the owner writes it.
export function announcementFor(input: {
  streak: MyStreak | null;
  seenDay: string | null;
  copy: string;
  production: boolean;
}): AnnouncementView | null {
  const { streak, seenDay } = input;
  if (!streak) return null;
  if (input.production && input.copy.includes(ANNOUNCEMENT_PLACEHOLDER)) return null;
  if (streak.state === "prelaunch") {
    if (seenDay !== null) return null;
    return { phase: "prelaunch", when: streak.launch ? launchLabel(streak.launch) : null };
  }
  if (seenDay !== null && seenDay >= streak.launch) return null;
  return { phase: "launched" };
}
