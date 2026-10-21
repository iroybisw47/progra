// Made-up streak states for the dev preview (app/dev/streaks), so every look
// of the badge, the sheet and the announcement card can be screenshotted
// without the SQL, a launch date or a real run of days.

import type { FriendStreak, MyStreak } from "@/lib/streaks-view";

export const STREAK_PREVIEW_FIXTURES = [
  "prelaunch",
  "prelaunch-undated",
  "zero",
  "at-risk",
  "12",
  "milestone-30",
  "400",
  "freeze-used",
  "launched-card",
  "friend-5",
  "friend-1",
  "friend-prelaunch",
] as const;
export type StreakPreviewFixture = (typeof STREAK_PREVIEW_FIXTURES)[number];

export type StreakPreview = {
  name: string;
  handle: string;
  own: MyStreak | null;
  friend: FriendStreak | null;
  // The streak day the announcement was dismissed on, if it was.
  seenDay: string | null;
};

const LAUNCH = "2026-10-21";

function live(over: Partial<Extract<MyStreak, { state: "live" }>>): MyStreak {
  return {
    state: "live",
    launch: LAUNCH,
    today: "2026-10-28",
    current: 0,
    longest: 0,
    atRisk: false,
    todayActive: false,
    freezesLeft: 2,
    freezeDays: [],
    milestone: null,
    unsettled: 0,
    ...over,
  };
}

const ME = { name: "Ishaan Roy Biswas", handle: "ishaan" };
// Long enough to prove the name truncates before the badge does.
const LONG = { name: "Alexandria Montgomery-Wellington", handle: "alexandria" };
const FRIEND = { name: "Maya Chen", handle: "maya" };

export function streakPreview(fixture: StreakPreviewFixture): StreakPreview {
  const seen = (seenDay: string | null) => ({ friend: null, seenDay });
  switch (fixture) {
    case "prelaunch":
      return { ...ME, own: { state: "prelaunch", launch: LAUNCH }, ...seen(null) };
    case "prelaunch-undated":
      return { ...ME, own: { state: "prelaunch", launch: null }, ...seen(null) };
    case "zero":
      return { ...ME, own: live({}), ...seen(LAUNCH) };
    case "at-risk":
      return { ...ME, own: live({ current: 4, longest: 4, atRisk: true }), ...seen(LAUNCH) };
    case "12":
      return { ...ME, own: live({ current: 12, longest: 12, todayActive: true, milestone: 7 }), ...seen(LAUNCH) };
    case "milestone-30":
      return { ...ME, own: live({ current: 30, longest: 41, todayActive: true, milestone: 30 }), ...seen(LAUNCH) };
    case "400":
      return {
        ...LONG,
        own: live({ current: 400, longest: 400, todayActive: true, milestone: 100, freezesLeft: 1 }),
        ...seen(LAUNCH),
      };
    case "freeze-used":
      return {
        ...ME,
        own: live({ current: 6, longest: 6, todayActive: true, freezesLeft: 1, freezeDays: ["2026-10-27"] }),
        ...seen(LAUNCH),
      };
    case "launched-card":
      return { ...ME, own: live({ current: 1, longest: 1, todayActive: true }), ...seen("2026-10-19") };
    case "friend-5":
      return { ...FRIEND, own: null, friend: { state: "live", launch: LAUNCH, current: 5, longest: 9 }, seenDay: null };
    case "friend-1":
      return { ...FRIEND, own: null, friend: { state: "live", launch: LAUNCH, current: 1, longest: 9 }, seenDay: null };
    case "friend-prelaunch":
      return { ...FRIEND, own: null, friend: { state: "prelaunch", launch: LAUNCH }, seenDay: null };
  }
}

export function parseStreakPreviewParams(
  params: Record<string, string | string[] | undefined>
): { fixture: StreakPreviewFixture; sheet: boolean } {
  const raw = Array.isArray(params.fixture) ? params.fixture[0] : params.fixture;
  const fixture = (STREAK_PREVIEW_FIXTURES as readonly string[]).includes(raw ?? "")
    ? (raw as StreakPreviewFixture)
    : "12";
  return { fixture, sheet: params.sheet === "1" };
}
