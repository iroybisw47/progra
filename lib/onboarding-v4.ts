// Onboarding v4's pure parts (design_handoff_onboarding_v4/README.md): the
// eight screens and their order, the progress bar and step eyebrows, the goal
// color defaults, the habit presets, the practice clock-in's curve, and the
// wizard's navigation rules as a reducer. No React, window or server code, so
// lib/onboarding-v4.test.ts pins the rules without a browser.
//
// v4 is v3's shell with a different run: the welcome, then the goals (now
// with a color each), v2's habits step, a four-step "How Progra works", v2's
// practice clock-in and post, the UW question (moved here from the welcome),
// find your friends, and a new notifications screen last. It ships dark behind
// ONBOARDING_V4. The pure helpers it shares with v3 are imported, not copied;
// the reducer is its own because v3's hard-codes seven screens, three beats
// and a UW sheet that only ever sits over the welcome.
//
// "R:<line>" cites the handoff README.

import { PALETTE } from "@/lib/palette";
import type { Step } from "@/lib/onboarding";
import {
  MAX_GOALS,
  clampGoalHours,
  formatGoalTitle,
  formatHabitName,
  goalHoursOrDefault,
  type UwChoice,
  type UwPhase,
} from "@/lib/onboarding-v3";
import { MAX_UW_INTERESTS, MAX_UW_MAJORS, cleanInterests, cleanMajors, normalizeMatchText } from "@/lib/uw";

// ---- Screens ----------------------------------------------------------------

// The eight screens, in order (R:6-17). The UW sheet and page aren't screens:
// they sit between the practice post and find your friends, as overlays on
// the post (R:131).
export const V4_SCREEN = {
  welcome: 0,
  goal: 1,
  habits: 2,
  how: 3,
  clock: 4,
  post: 5,
  friends: 6,
  notify: 7,
} as const;
export const V4_SCREEN_COUNT = 8;

// Each screen's step name, as analytics already accepts them (the prod CHECK
// on profiles.onboarding_step and the event allowlist list exactly STEPS). Sent
// with flow "v4", since the order is v4's own.
export const V4_STEPS = [
  "welcome",
  "goal",
  "habit",
  "how",
  "clock",
  "post",
  "friends",
  "notify",
] as const satisfies readonly Step[];
export type V4Step = (typeof V4_STEPS)[number];

// ---- Progress and step eyebrows ----------------------------------------------

// "How Progra works" has four steps on one screen (R:99-114).
export const HOW_STEPS = 4;

// How many screens this run has: eight, or seven where the notifications
// screen isn't shown (the website, or a device iOS has already asked), which
// leaves find your friends last. Being last, it never renumbers another.
export function screenTotal(notifyShown: boolean): number {
  return notifyShown ? V4_SCREEN_COUNT : V4_SCREEN_COUNT - 1;
}

// The progress bar's fill, 0-1 (R:34): step/of, where step is the screen's
// index + 1. On How Progra works it creeps with each of its steps,
// (3 + (howStep + 1) / 4) / of, so the fourth lands where the screen's own
// whole step would.
export function progressFill(screen: number, howStep: number, notifyShown: boolean): number {
  const of = screenTotal(notifyShown);
  const at = Math.min(Math.max(0, Math.floor(screen)), of - 1);
  if (at === V4_SCREEN.how) {
    const k = Math.min(Math.max(0, Math.floor(howStep)), HOW_STEPS - 1);
    return (V4_SCREEN.how + (k + 1) / HOW_STEPS) / of;
  }
  return (at + 1) / of;
}

// The "Step N of M" eyebrow for the screens that carry one (habits and the
// two practice screens), numbered as the progress bar counts (the owner's
// call, 2026-10-28: the numbering stays consistent throughout onboarding).
export function stepEyebrow(screen: number, notifyShown: boolean, practice = false): string {
  const text = `Step ${screen + 1} of ${screenTotal(notifyShown)}`;
  return practice ? `${text} · Practice` : text;
}

// ---- Screen 02: goals and their colors ---------------------------------------

// The example chips (R:79), in order.
export const V4_GOAL_EXAMPLES = ["Reading", "Studying", "Exercising", "Recharging"] as const;

// The order new goals take their colors in (R:86): the first palette index
// whose fill no listed goal already has.
export const GOAL_COLOR_ORDER = [7, 2, 5, 9, 3, 6, 10, 0, 1, 4, 8] as const;

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function nextGoalColor(used: readonly string[]): string {
  const free = GOAL_COLOR_ORDER.find((i) => !used.some((u) => sameHex(u, PALETTE[i].fill)));
  return PALETTE[free ?? GOAL_COLOR_ORDER[used.length % GOAL_COLOR_ORDER.length]].fill;
}

// ---- Screen 03: habits ---------------------------------------------------------

// The preset tiles (R:94), from v2, with their colors.
export const V4_HABITS: readonly { name: string; color: string }[] = [
  { name: "Journaling", color: PALETTE[9].fill },
  { name: "Meditation", color: PALETTE[6].fill },
  { name: "Stretching", color: PALETTE[5].fill },
  { name: "Drinking water", color: PALETTE[7].fill },
];

const CUSTOM_HABIT_ORDER = [7, 2, 5, 3, 9, 6, 10] as const;

// The `k`th habit typed in (0-based) takes this color (R:94).
export function customHabitColor(k: number): string {
  const i = Math.max(0, Math.floor(k)) % CUSTOM_HABIT_ORDER.length;
  return PALETTE[CUSTOM_HABIT_ORDER[i]].fill;
}

// A habit's color as its tile shows it and createHabit stores it: a preset's
// own, or its place among the typed ones. Null for a name with no tile.
export function habitColor(name: string, customHabits: readonly string[]): string | null {
  const key = normalizeMatchText(name);
  const preset = V4_HABITS.find((h) => normalizeMatchText(h.name) === key);
  if (preset) return preset.color;
  const k = customHabits.findIndex((h) => normalizeMatchText(h) === key);
  return k < 0 ? null : customHabitColor(k);
}

// The habits as the account has them: every active one selected, a preset's
// tile for one that matches it, a typed tile for the rest. As v3's
// prefillWizard does for its own presets.
export function prefillHabits(
  habits: readonly { name: string }[]
): { habits: string[]; customHabits: string[] } {
  const presetFor = new Map(V4_HABITS.map((h) => [normalizeMatchText(h.name), h.name]));
  const seen = new Set<string>();
  const selected: string[] = [];
  const custom: string[] = [];
  for (const h of habits) {
    const name = h.name.trim();
    const key = normalizeMatchText(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const preset = presetFor.get(key);
    selected.push(preset ?? name);
    if (!preset) custom.push(name);
  }
  return { habits: selected, customHabits: custom };
}

// The CTA (R:97): "Save habit", "Save habits" once more than one is picked.
export function habitsCtaLabel(picked: number): string {
  return picked > 1 ? "Save habits" : "Save habit";
}

// ---- Screen 05: the practice clock-in ----------------------------------------

// Real time for 1.5s, then an ease-out cubic to 25:00 over 1.8s (R:121). When
// it reaches 25:00 the screen waits 500ms and moves on by itself.
export const PRACTICE_TARGET_MS = 25 * 60_000;
export const PRACTICE_REALTIME_MS = 1_500;
export const PRACTICE_FAST_MS = 1_800;
export const PRACTICE_TOTAL_MS = PRACTICE_REALTIME_MS + PRACTICE_FAST_MS;
export const PRACTICE_HOLD_MS = 500;

export function practiceElapsed(realMs: number): number {
  if (!Number.isFinite(realMs) || realMs <= 0) return 0;
  if (realMs < PRACTICE_REALTIME_MS) return realMs;
  const p = Math.min(1, (realMs - PRACTICE_REALTIME_MS) / PRACTICE_FAST_MS);
  const eased = 1 - (1 - p) ** 3;
  return PRACTICE_REALTIME_MS + eased * (PRACTICE_TARGET_MS - PRACTICE_REALTIME_MS);
}

// The practice session's name: what was typed, or "Practice" (R:119, R:127).
export const PRACTICE_NAME = "Practice";
export function practiceName(typed: string | null | undefined): string {
  return typed?.trim() || PRACTICE_NAME;
}

// ---- How Progra works: the timer ----------------------------------------------

// Step 1's live timer, h:mm:ss (R:110).
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ---- The wizard ---------------------------------------------------------------

export type V4State = {
  screen: number; // an index into V4_STEPS; see V4_SCREEN
  howStep: number; // How Progra works' step, 0..HOW_STEPS-1
  // The UW question, a sheet over the posted practice session (R:131), and
  // the UW page a Yes opens, between the post and find your friends. Only
  // ever up on the post screen. The answer outlives both, as in v3.
  uwSheet: boolean;
  uwPage: boolean;
  uw: UwChoice | null;
  uwPhase: UwPhase;
  majors: string[];
  interests: string[];
  uwListed: boolean;
  // Goals, their weekly hours, the row each is saved on, and its color (a
  // palette fill hex, or a replayer's own stored color), by position. All
  // four are added, removed and set together, so they never misalign.
  goals: string[];
  goalHours: number[];
  goalRowIds: (string | null)[];
  goalColors: string[];
  habits: string[]; // selected, in pick order
  customHabits: string[]; // tiles typed in, beyond V4_HABITS
};

export type V4Action =
  | { type: "go"; to: number }
  | { type: "back" }
  // Screen 03 through 05's way on and back within How Progra works.
  | { type: "nextHow" }
  | { type: "prevHow" }
  // The post's Continue with UW on: the sheet, or the page while the answer
  // is already Yes.
  | { type: "openUwSheet" }
  | { type: "closeUwSheet" }
  | { type: "pickUw"; choice: UwChoice }
  | { type: "openUw" }
  | { type: "changeUw" }
  | { type: "setMajors"; majors: readonly string[] }
  | { type: "setInterests"; interests: readonly string[] }
  // `hours` and `rowId` as v3's newGoalHours finds them; `color` the one it
  // starts in (the shell's: the matched row's own, else nextGoalColor).
  | { type: "addGoal"; title: string; hours?: number; rowId?: string | null; color?: string }
  | { type: "removeGoal"; index: number }
  | { type: "setGoalHours"; index: number; hours: number }
  | { type: "setGoalColor"; index: number; color: string }
  | { type: "setGoalRowIds"; ids: readonly (string | null)[]; goals: readonly string[] }
  | { type: "toggleHabit"; name: string }
  | { type: "addCustomHabit"; name: string };

export function initialV4State(): V4State {
  return {
    screen: V4_SCREEN.welcome,
    howStep: 0,
    uwSheet: false,
    uwPage: false,
    uw: null,
    uwPhase: "choose",
    majors: [],
    interests: [],
    uwListed: false,
    goals: [],
    goalHours: [],
    goalRowIds: [],
    goalColors: [],
    habits: [],
    customHabits: [],
  };
}

const isUwOpen = (s: V4State) => s.uw === "yes" && s.uwPhase === "open";

// The answer as the sheet should show it next time (v3's settleUw): after
// No, the tiles ask again; mid-Yes, the open page.
function settleUw(s: V4State): V4State {
  if (s.uw === "no") return { ...s, uw: null, uwPhase: "choose" };
  if (s.uw === "yes" && s.uwPhase === "selecting") return { ...s, uwPhase: "open" };
  return s;
}

// Move to a screen. Every move takes the UW sheet down and the page away.
// Coming back to the post from find your friends lands on the UW page while
// the answer is Yes (R:131). Entering How Progra works starts it at step 1,
// except coming back from the practice clock-in, which lands on step 4
// (R:114).
function go(s: V4State, to: number): V4State {
  if (!Number.isFinite(to)) return s;
  const screen = Math.min(Math.max(0, Math.floor(to)), V4_SCREEN_COUNT - 1);
  if (screen === s.screen) return s;
  let next: V4State = { ...s, screen, uwSheet: false, uwPage: false };
  if (screen === V4_SCREEN.post) {
    next = settleUw(next);
    if (s.screen > V4_SCREEN.post && isUwOpen(next)) next.uwPage = true;
  }
  if (screen === V4_SCREEN.how) next.howStep = s.screen > V4_SCREEN.how ? HOW_STEPS - 1 : 0;
  return next;
}

function removeAt<T>(list: T[], index: number): T[] {
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function replaceList(
  current: string[],
  list: readonly string[],
  clean: (values: unknown) => string[],
  max: number
): string[] {
  const next = clean(list).slice(0, max);
  return sameList(next, current) ? current : next;
}

// Every action that changes nothing returns the same state object.
export function v4Reducer(state: V4State, action: V4Action): V4State {
  switch (action.type) {
    case "go":
      return go(state, action.to);
    case "back":
      // The UW page goes back to the post under it; the welcome has no Back.
      if (state.uwPage) return { ...state, uwPage: false };
      return state.screen > 0 ? go(state, state.screen - 1) : state;

    case "nextHow":
      if (state.screen !== V4_SCREEN.how) return state;
      return state.howStep < HOW_STEPS - 1
        ? { ...state, howStep: state.howStep + 1 }
        : go(state, V4_SCREEN.clock);
    case "prevHow":
      if (state.screen !== V4_SCREEN.how || state.howStep === 0) return state;
      return { ...state, howStep: state.howStep - 1 };

    case "openUwSheet": {
      if (state.screen !== V4_SCREEN.post || state.uwSheet || state.uwPage) return state;
      const settled = settleUw(state);
      return isUwOpen(settled) ? { ...settled, uwPage: true } : { ...settled, uwSheet: true };
    }
    case "closeUwSheet":
      if (!state.uwSheet || state.uwPhase === "selecting") return state;
      return { ...state, uwSheet: false };
    case "pickUw":
      // Only from the tiles of a sheet that's up (v3's rule), and Yes is the
      // tap that lists.
      if (state.screen !== V4_SCREEN.post || !state.uwSheet || state.uwPhase !== "choose") {
        return state;
      }
      return {
        ...state,
        uw: action.choice,
        uwPhase: "selecting",
        uwListed: action.choice === "yes" ? true : state.uwListed,
      };
    case "openUw":
      if (state.uw !== "yes" || state.uwPhase !== "selecting") return state;
      return { ...state, uwPhase: "open", uwSheet: false, uwPage: state.screen === V4_SCREEN.post };
    case "changeUw":
      if (state.uw === null && state.uwPhase === "choose") return state;
      return {
        ...state,
        uw: null,
        uwPhase: "choose",
        uwPage: false,
        uwSheet: state.screen === V4_SCREEN.post,
      };
    case "setMajors": {
      const majors = replaceList(state.majors, action.majors, cleanMajors, MAX_UW_MAJORS);
      return majors === state.majors ? state : { ...state, majors };
    }
    case "setInterests": {
      const interests = replaceList(state.interests, action.interests, cleanInterests, MAX_UW_INTERESTS);
      return interests === state.interests ? state : { ...state, interests };
    }

    case "addGoal": {
      const title = formatGoalTitle(action.title);
      if (!title || state.goals.length >= MAX_GOALS) return state;
      const { rowId } = action;
      const held = typeof rowId === "string" && rowId !== "" && !state.goalRowIds.includes(rowId);
      return {
        ...state,
        goals: [...state.goals, title],
        goalHours: [...state.goalHours, goalHoursOrDefault(action.hours)],
        goalRowIds: [...state.goalRowIds, held ? rowId : null],
        goalColors: [...state.goalColors, action.color ?? nextGoalColor(state.goalColors)],
      };
    }
    case "removeGoal": {
      // The others keep their colors (R:86).
      const goals = removeAt(state.goals, action.index);
      if (goals === state.goals) return state;
      return {
        ...state,
        goals,
        goalHours: removeAt(state.goalHours, action.index),
        goalRowIds: removeAt(state.goalRowIds, action.index),
        goalColors: removeAt(state.goalColors, action.index),
      };
    }
    case "setGoalHours": {
      const at = action.index;
      const hours = clampGoalHours(action.hours);
      if (!Number.isInteger(at) || at < 0 || at >= state.goals.length || hours === null) {
        return state;
      }
      if (state.goalHours[at] === hours) return state;
      return { ...state, goalHours: state.goalHours.map((h, i) => (i === at ? hours : h)) };
    }
    case "setGoalColor": {
      const at = action.index;
      if (!Number.isInteger(at) || at < 0 || at >= state.goals.length || !action.color) return state;
      if (sameHex(state.goalColors[at] ?? "", action.color)) return state;
      return {
        ...state,
        goalColors: state.goalColors.map((c, i) => (i === at ? action.color : c)),
      };
    }
    case "setGoalRowIds": {
      if (!sameList(action.goals, state.goals) || action.ids.length !== state.goals.length) {
        return state;
      }
      const seen = new Set<string>();
      const ids = action.ids.map((id) => {
        if (typeof id !== "string" || id === "" || seen.has(id)) return null;
        seen.add(id);
        return id;
      });
      return sameList(ids, state.goalRowIds) ? state : { ...state, goalRowIds: ids };
    }

    case "toggleHabit": {
      const on = state.habits.includes(action.name);
      return {
        ...state,
        habits: on ? state.habits.filter((h) => h !== action.name) : [...state.habits, action.name],
      };
    }
    case "addCustomHabit": {
      // Appended to the grid and selected (R:96). A name a tile already has,
      // ignoring case, selects that tile instead.
      const name = formatHabitName(action.name);
      if (!name) return state;
      const key = normalizeMatchText(name);
      const existing = [...V4_HABITS.map((h) => h.name), ...state.customHabits].find(
        (h) => normalizeMatchText(h) === key
      );
      const label = existing ?? name;
      const customHabits = existing ? state.customHabits : [...state.customHabits, name];
      const habits = state.habits.includes(label) ? state.habits : [...state.habits, label];
      if (customHabits === state.customHabits && habits === state.habits) return state;
      return { ...state, customHabits, habits };
    }
  }
}

// ---- Goal 1, as the later screens show it --------------------------------------

// Goal 1's title, color and weekly hours, which How Progra works, the practice
// screens and the notification previews all use (R:87). Screen 02 needs a
// goal, so the fallback only shows in the dev preview opened past it.
export type FirstGoal = { title: string; color: string; hours: number };

export function firstGoal(state: Pick<V4State, "goals" | "goalColors" | "goalHours">): FirstGoal {
  return {
    title: state.goals[0]?.trim() || V4_GOAL_EXAMPLES[1],
    color: state.goalColors[0] || PALETTE[GOAL_COLOR_ORDER[0]].fill,
    hours: goalHoursOrDefault(state.goalHours[0]),
  };
}
