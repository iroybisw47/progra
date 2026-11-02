// The dev preview's URL for onboarding v4 (app/dev/onboarding-v4), parsed.
// It reuses v3's fixtures (lib/onboarding-v3-preview.ts) for who the person
// is and what their account has, and its fake services; only which screen and
// which state to open on are v4's own.
//
//   ?step=welcome|goal|habits|how|clock|post|group|friends|notify  (or 1-9)
//   &how=1..4        How Progra works' step
//   &fixture=…       any of v3's PREVIEW_FIXTURES (goals, habits, uw-sheet, …)
//   &uw=1|0          the UW variant on or off (the uw-* fixtures turn it on)
//   &posted=1        the practice post already posted
//   &notify=0        a device that has already answered iOS: no notifications
//                    screen, so find your friends is last
//   &q=…             typed into find your friends' search
//   &groups=1|0      the "Join a group" step in the run or not (GROUPS_ONBOARDING);
//                    on by default only when the URL opens on it
//
// The uw-sheet, uw-sheet-no and uw-page fixtures open on the posted practice
// post, where v4 asks the question, with the sheet up or the page in front.
// Unknown values fall back rather than error: it's a tool for pictures.

import {
  PREVIEW_FIXTURES,
  type PreviewFixture,
} from "@/lib/onboarding-v3-preview";
import type { GroupSummary } from "@/lib/groups";
import { HOW_STEPS, V4_SCREEN, V4_SCREEN_COUNT } from "@/lib/onboarding-v4";

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STEP_NAMES: Record<string, number> = {
  welcome: V4_SCREEN.welcome,
  goal: V4_SCREEN.goal,
  goals: V4_SCREEN.goal,
  habits: V4_SCREEN.habits,
  how: V4_SCREEN.how,
  clock: V4_SCREEN.clock,
  post: V4_SCREEN.post,
  group: V4_SCREEN.group,
  groups: V4_SCREEN.group,
  friends: V4_SCREEN.friends,
  notify: V4_SCREEN.notify,
};

// The screen a fixture is about, when the URL names none.
const FIXTURE_STEP: Partial<Record<PreviewFixture, number>> = {
  goals: V4_SCREEN.goal,
  "goals-full": V4_SCREEN.goal,
  habits: V4_SCREEN.habits,
  "habit-custom": V4_SCREEN.habits,
  "friends-search": V4_SCREEN.friends,
  "friends-added": V4_SCREEN.friends,
  "friends-known": V4_SCREEN.friends,
  "friends-nohits": V4_SCREEN.friends,
  "uw-sheet": V4_SCREEN.post,
  "uw-sheet-no": V4_SCREEN.post,
  "uw-page": V4_SCREEN.post,
  "uw-groups": V4_SCREEN.friends,
  "uw-early": V4_SCREEN.friends,
};

const UW_FIXTURES: ReadonlySet<PreviewFixture> = new Set([
  "uw-sheet",
  "uw-page",
  "uw-sheet-no",
  "uw-groups",
  "uw-early",
]);

export type V4PreviewParams = {
  screen: number;
  howStep: number;
  fixture: PreviewFixture;
  uw?: boolean;
  posted: boolean;
  notify: boolean;
  query?: string;
  // The group step's list, or null: not in the run.
  groups: GroupSummary[] | null;
};

// The made-up groups the step lists: one you'd be friended into, one just
// started, one empty, one full.
export const PREVIEW_V4_GROUPS: GroupSummary[] = [
  { groupId: "00000000-0000-4000-8000-0000000000b1", name: "UW CS 2027", description: null, memberCap: 50, memberCount: 31, isMember: false, friendableCount: 31 },
  { groupId: "00000000-0000-4000-8000-0000000000b2", name: "Morning runners", description: null, memberCap: 50, memberCount: 1, isMember: false, friendableCount: 1 },
  { groupId: "00000000-0000-4000-8000-0000000000b3", name: "Thesis writers", description: null, memberCap: 50, memberCount: 0, isMember: false, friendableCount: 0 },
  { groupId: "00000000-0000-4000-8000-0000000000b4", name: "Founders' focus club", description: null, memberCap: 50, memberCount: 50, isMember: false, friendableCount: 50 },
];

export function parseV4PreviewParams(params: Params): V4PreviewParams {
  const raw = first(params.fixture);
  const fixture = (PREVIEW_FIXTURES as readonly string[]).includes(raw ?? "")
    ? (raw as PreviewFixture)
    : "welcome";
  const stepRaw = (first(params.step) ?? "").toLowerCase();
  const n = Number.parseInt(stepRaw, 10);
  const screen =
    STEP_NAMES[stepRaw] ??
    (Number.isFinite(n)
      ? Math.min(Math.max(n, 1), V4_SCREEN_COUNT) - 1
      : (FIXTURE_STEP[fixture] ?? V4_SCREEN.welcome));
  const h = Number.parseInt(first(params.how) ?? "", 10);
  const howStep = Number.isFinite(h) ? Math.min(Math.max(h, 1), HOW_STEPS) - 1 : 0;
  const u = first(params.uw);
  const uw = u === "1" ? true : u === "0" ? false : UW_FIXTURES.has(fixture) ? true : undefined;
  const posted =
    first(params.posted) === "1" || (screen === V4_SCREEN.post && UW_FIXTURES.has(fixture));
  return {
    screen,
    howStep,
    fixture,
    uw,
    posted,
    notify: first(params.notify) !== "0",
    query: first(params.q),
    groups:
      first(params.groups) === "1" || (first(params.groups) !== "0" && screen === V4_SCREEN.group)
        ? PREVIEW_V4_GROUPS
        : null,
  };
}
