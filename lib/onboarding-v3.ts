// Onboarding v3's pure parts (.claude/plans/onboarding-v3.md, P2): input
// formatting, the copy each screen builds from what the user entered, and the
// wizard's navigation rules as a reducer. There is no React, window or server
// code here. The screens (P3–P7) render it, and the rules that are easy to
// get subtly wrong are pinned by lib/onboarding-v3.test.ts rather than
// discovered on a device.
//
// Screen 1 is v2's welcome screen since OWNER-FIX-3 (2026-10-11), with v2's
// own handle rules (checkUsername alone, lib/onboarding-v3-identity.ts), so
// the live handle check's suggestions, alternatives and name formatting that
// lived here are gone.
//
// "R:<line>" and "P:<line>" cite the design handoff's README and prototype, as
// the plan does. Where the prototype and the app's own rules disagree, the
// app's rules win and the comment says which.
//
// Nothing imports this yet: it ships dark until ONBOARDING_V3 flips.

import { DEFAULT_GOAL_QUOTA_HOURS, V3_STEPS } from "@/lib/onboarding";
import { PALETTE, type PaletteColor } from "@/lib/palette";
import {
  MAX_UW_INTERESTS,
  MAX_UW_MAJORS,
  cleanInterests,
  cleanMajor,
  cleanMajors,
  normalizeMatchText,
} from "@/lib/uw";

// ---- Screens ----------------------------------------------------------------

// The seven screens, each an index into V3_STEPS (lib/onboarding.ts). The index
// is what the wizard navigates by, and V3_STEPS[index] is the step name
// analytics already accepts for that screen. The names here describe the
// screens. Note that the intro is analytics' "how".
export const SCREEN = {
  identity: 0,
  goal: 1,
  habits: 2,
  intro: 3,
  friends: 4,
  notify: 5,
  ready: 6,
} as const;
export const SCREEN_COUNT = V3_STEPS.length;

// ---- Notifications screen -------------------------------------------------------

// The notifications screen asks, and only where the ask can still do
// something: in the app, while iOS hasn't been answered. That is exactly the
// `prompt` state. The website reads "unavailable", a device that already said
// yes or no reads "granted" or "denied" (iOS only ever asks once), and a read
// still in flight reads null; each of those steps over the screen rather than
// show a button that would do nothing. Settings is the way back for "denied".
// So does a build with nothing to send (notifyReasons empty): the ask would
// spend iOS's one dialog on nothing.
export function notifyScreenShown(
  permission: string | null,
  reasons: readonly string[]
): boolean {
  return permission === "prompt" && reasons.length > 0;
}

// Where a move lands once the notifications screen is stepped over: on through it the way the
// move was going (forward to the ready screen, Back to friends). Every other
// destination is left alone.
export function stepOverNotify(to: number, from: number, shown: boolean): number {
  if (shown || to !== SCREEN.notify) return to;
  return to > from ? SCREEN.ready : SCREEN.friends;
}

// The progress bar's step and total, as the person sees the wizard: with
// the notifications screen stepped over there's one screen fewer, and the ready screen is the
// last of six rather than seven.
export function progressFor(screen: number, shown: boolean): { at: number; of: number } {
  if (shown) return { at: screen, of: SCREEN_COUNT };
  return { at: screen > SCREEN.notify ? screen - 1 : screen, of: SCREEN_COUNT - 1 };
}

// What the notifications screen says they're for: only what this build will
// actually send, so the screen never promises a reminder that's switched off.
// Each row is a flag's feature (lib/flags.ts).
export function notifyReasons(flags: {
  clockReminders: boolean;
  habitReminders: boolean;
  socialPush: boolean;
  nudges: boolean;
  recapPush: boolean;
}): string[] {
  const out: string[] = [];
  if (flags.clockReminders) out.push("A reminder each hour you’re still clocked in");
  if (flags.habitReminders) out.push("A daily reminder for your habits");
  if (flags.socialPush) out.push("When friends like or comment on your sessions");
  if (flags.socialPush) out.push("When someone sends you a friend request");
  // A nudge only buzzes with SOCIAL_PUSH on too (lib/flags.ts, NUDGES).
  if (flags.socialPush && flags.nudges) out.push("When a friend nudges you to get going");
  if (flags.recapPush) out.push("When your weekly recap is ready");
  return out;
}

// ---- Text helpers -------------------------------------------------------------

// `s` cut to at most `max` characters (code points), never splitting a
// grapheme: a flag, a skin-toned emoji or a ZWJ sequence that would straddle
// the cap is dropped whole rather than left as a lone regional indicator or a
// bare base emoji. Counting code points, not graphemes, keeps the result's
// UTF-16 length at most 2 × max, which is what the server caps sit on
// (createGoal's 120 for a GOAL_TITLE_MAX of 60). Where Intl.Segmenter is
// missing it falls back to code points, which still never leaves a lone
// surrogate.
function capChars(s: string, max: number): string {
  if (s.length <= max) return s; // code points <= UTF-16 units, so it fits
  const pieces =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s),
          (x) => x.segment
        )
      : Array.from(s);
  let out = "";
  let used = 0;
  for (const piece of pieces) {
    const n = Array.from(piece).length;
    if (used + n > max) break;
    out += piece;
    used += n;
  }
  return out;
}

// A first letter, uppercased. A letter whose uppercase is two characters
// ("ß" → "SS") is left alone so it can't push the text past its cap or shift
// the caret. Typed habits use it (formatHabitName).
function upperInitial(ch: string): string {
  const up = ch.toUpperCase();
  return up.length === 1 ? up : ch;
}

// ---- Screen 2: goals --------------------------------------------------------

export const MAX_GOALS = 3;
export const GOAL_TITLE_MAX = 60;

// A goal's weekly hours on Screen 2 (OWNER-FIX-2): whole hours from 1 to 40,
// the range of the Goals page's own stepper (components/v2/manage-goals.tsx),
// starting at DEFAULT_GOAL_QUOTA_HOURS.
export const GOAL_HOURS_MIN = 1;
export const GOAL_HOURS_MAX = 40;

// A typed goal as it's listed: trimmed, whitespace collapsed, and capped at
// GOAL_TITLE_MAX without splitting a grapheme (capChars). Empty means nothing
// to add. The reducer's addGoal stores exactly this, and the shell runs it
// first to look the title up among the saved rows (newGoalHours).
export function formatGoalTitle(raw: string): string {
  return capChars(raw.trim().replace(/\s+/g, " "), GOAL_TITLE_MAX).trimEnd();
}

// The example chips under the goal field (R:94), exact strings, in order.
export const GOAL_EXAMPLES = [
  "Launch my side project",
  "Get stronger",
  "Ace organic chem",
  "Train for a half marathon",
  "Learn Spanish",
  "Finish my thesis",
] as const;

// Goal colors by position (R:95): palette 7 (dark blue), 2 (orange), 5
// (green). Returns the whole PaletteColor because Screen 4's sample post sets
// the goal's duration pill in its INK (R:113), and the goal itself is created
// with its FILL. Positions past the third reuse the third, which never happens
// while MAX_GOALS is 3.
const GOAL_PALETTE = [7, 2, 5] as const;
export function goalColor(i: number): PaletteColor {
  const at = Math.min(Math.max(0, Math.floor(i)), GOAL_PALETTE.length - 1);
  return PALETTE[GOAL_PALETTE[at]];
}

// The goal field's placeholder for `n` goals already added (R:93). At the
// cap Screen 2 fades the field out altogether, since on a short screen it
// sat under Continue, so "Three is plenty" is the design's words more than
// anything shown.
export function goalPlaceholder(n: number): string {
  if (n >= MAX_GOALS) return "Three is plenty";
  return n > 0 ? "Add another (optional)" : "Type your own";
}

// The hint under the goal field (R:93, P:953), shown only while there is text.
// The long form invites another goal, so it only appears while one more would
// still leave room. At the cap Return adds nothing (P:921), so there is no
// hint. The prototype still says "Return adds it" there, which isn't true.
export function goalHint(n: number, draft: string): string {
  if (!draft.trim() || n >= MAX_GOALS) return "";
  return n < MAX_GOALS - 1
    ? "Return adds it, then add another or continue"
    : "Return adds it";
}

// The example chips still worth showing: none at the cap, and never one
// already added, compared case-insensitively (R:94).
export function goalExamplesFor(goals: readonly string[]): string[] {
  if (goals.length >= MAX_GOALS) return [];
  const added = new Set(goals.map(normalizeMatchText));
  return GOAL_EXAMPLES.filter((g) => !added.has(normalizeMatchText(g)));
}

// The hours a goal's box starts at. A stored quota is kept as it is, even one
// the box itself couldn't set (2.5, or 60 from before the Goals page's 1–40
// range), so a replay that leaves the box alone writes nothing. Anything that
// isn't a positive number, which createGoal would refuse, is the 5h default.
export function goalHoursOrDefault(hours: number | null | undefined): number {
  return typeof hours === "number" && Number.isFinite(hours) && hours > 0
    ? hours
    : DEFAULT_GOAL_QUOTA_HOURS;
}

// The hours a box sets: whole hours, kept within 1–40. Null for something
// that isn't a number, which sets nothing.
export function clampGoalHours(hours: number): number | null {
  if (typeof hours !== "number" || Number.isNaN(hours)) return null;
  return Math.min(GOAL_HOURS_MAX, Math.max(GOAL_HOURS_MIN, Math.round(hours)));
}

// The whole hours in what was typed or pasted, as digits, at most three:
// what the field's text commits as (resolveHoursDraft). Whole hours only, so
// everything from the first decimal point or comma on is dropped before the
// digits are kept: "2.5" is "2" and "1,5" is "1", not 25 and 15, and ".5" is
// nothing, which keeps the hours as they were. Three digits, though 40 is the
// most the box takes, so "100" snaps to 40 rather than being read as "10".
// Full-width digits and points count (NFKC turns "１２" into "12" and "．"
// into "."), as a Japanese or Chinese keyboard in full-width mode types them.
// "10h" is "10".
export function hoursInput(raw: string): string {
  const text = raw.normalize("NFKC");
  const point = text.search(/[.,]/);
  return (point < 0 ? text : text.slice(0, point)).replace(/\D/g, "").slice(0, 3);
}

// The hours field's text after every keystroke, and once an IME composition
// ends: digits, with one decimal point or comma at most among them, three
// characters at most, full-width ones read as ASCII (NFKC). The point stays
// in the text as typed, because the field cleans itself on every keystroke:
// were it dropped as it's typed, the "5" after it would run on into the whole
// hours, and "2.5" typed key by key would read 25. What commits is still whole
// hours (hoursInput: "2.5" is 2). A pasted "10h" is "10".
export function hoursFieldText(raw: string): string {
  const text = raw.normalize("NFKC").replace(/[^0-9.,]/g, "");
  const point = text.search(/[.,]/);
  const one =
    point < 0 ? text : text.slice(0, point + 1) + text.slice(point + 1).replace(/[.,]/g, "");
  return one.slice(0, 3);
}

// What a draft commits as when the box is left (or on Return). The field
// starts out holding the hours as they are (formatGoalHours), so that text,
// left as it was, keeps them exactly, a stored 2.5 or 60 included, rather
// than reading as 2 or snapping to 40. So does a field emptied, with nothing
// typed. Otherwise it's the whole hours typed (hoursInput), and out of range
// snaps to the nearest limit and says so (`snapped`) so the box can shake.
// "07" is 7.
export function resolveHoursDraft(
  text: string,
  current: number
): { hours: number; snapped: boolean } {
  if (text === formatGoalHours(current)) return { hours: current, snapped: false };
  const digits = hoursInput(text);
  if (!digits) return { hours: current, snapped: false };
  const n = Number.parseInt(digits, 10);
  if (n < GOAL_HOURS_MIN) return { hours: GOAL_HOURS_MIN, snapped: true };
  if (n > GOAL_HOURS_MAX) return { hours: GOAL_HOURS_MAX, snapped: true };
  return { hours: n, snapped: false };
}

// − and +: the next whole hour down or up, within 1–40, so a stored 2.5 steps
// to 2 or 3 and 60 comes down to 40. At a limit, or past it and pressed
// further out, it returns `current` itself, which is the box's cue to shake.
export function stepGoalHours(current: number, dir: 1 | -1): number {
  const clamp = (h: number) => Math.min(GOAL_HOURS_MAX, Math.max(GOAL_HOURS_MIN, h));
  if (dir > 0) return current >= GOAL_HOURS_MAX ? current : clamp(Math.floor(current) + 1);
  return current <= GOAL_HOURS_MIN ? current : clamp(Math.ceil(current) - 1);
}

// Hours as the box shows them: whole hours bare, anything else (a stored 2.5)
// to one decimal.
export function formatGoalHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

// The hours in words, for the box's spinbutton and what it announces.
export function hoursText(hours: number): string {
  return `${formatGoalHours(hours)} ${hours === 1 ? "hour" : "hours"} a week`;
}

// A key for each listed goal that stays with it when another is removed: its
// title, and how many identical titles sit above it (two goals may share one,
// P:918-924). Keyed by position instead, removing the first goal would remount
// every row below it, and a half-typed hours box would lose its draft and its
// focus.
export function goalKeys(titles: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((t) => {
    const k = seen.get(t) ?? 0;
    seen.set(t, k + 1);
    return `${k}:${t}`;
  });
}

// ---- Screen 3: habits -------------------------------------------------------

// The preset habit chips (R:101), exact strings, in order. These replace v2's
// HABIT_PRESETS. They carry no color, because createHabit assigns one (plan P4).
export const V3_HABITS = [
  "Drink water",
  "Meditate",
  "Journal",
  "Sub 1 hour Instagram",
  "Stretch",
] as const;

export const HABIT_NAME_MAX = 32;

// A typed "Your own" habit as it becomes a chip (R:102, P:984): trimmed,
// whitespace collapsed, first letter capitalized, capped without splitting a
// grapheme (capChars). Empty means nothing to add.
export function formatHabitName(raw: string): string {
  const collapsed = capChars(raw.trim().replace(/\s+/g, " "), HABIT_NAME_MAX).trimEnd();
  if (!collapsed) return "";
  return upperInitial(collapsed.charAt(0)) + collapsed.slice(1);
}

// The line beside Screen 3's "Nudge" pill (R:103, P:999), naming the first
// habit picked (the reducer's habits[0]). This is the live line. The intro's
// nudgeLine (P:1092) is dead prototype code and is not built (plan §8).
// Hidden entirely when NUDGES is off (D15).
export function habitNudgeText(firstHabit: string | null | undefined): string {
  const habit = firstHabit?.trim();
  return habit
    ? `Friends can nudge you if “${habit}” is still open tonight.`
    : "If a habit’s still open at night, friends can send you a nudge.";
}

// ---- Screen 4: the intro ----------------------------------------------------

export const INTRO_BEATS = 3;

// The three beat captions (R:108-111). The first wraps goal 1's title, drawn
// with its color square, so it comes in two halves around it.
export const INTRO_CAPTIONS = {
  feed: ["When you clock in on ", ", your friends see it in their feed."],
  hours: "Your hours add up.",
  friends: "And friends keep each other going.",
} as const;

export type IntroSegment = { id: string; name: string; color: string; ms: number };

const MIN = 60_000;

// Beat 2's illustrative week (R:114-121, P:1072-1075), for someone with no
// tracked time of their own: Schoolwork, goal 1, goal 2 if there is one, Gym
// and Reading, sorted by time, largest first. Schoolwork here is sample data
// in the design's dark purple (palette 9, #6F4E93), like Gym and Reading:
// since OWNER-FIX-1 the app creates no such category. It is shaped for CategoryDonut's
// `segs` (CatSeg), so total it for `totalMs`. When a replayer HAS tracked this
// week, P5 passes their real categories instead (D15).
//
// Goal 1 always exists by Screen 4, because Screen 2 needs one. The fallback
// title is only there so a bad call still draws something sensible.
export function introSegments(goals: readonly string[]): IntroSegment[] {
  const first = goals[0]?.trim() || GOAL_EXAMPLES[0];
  const second = goals[1]?.trim();
  const segs: IntroSegment[] = [
    { id: "schoolwork", name: "Schoolwork", color: PALETTE[9].fill, ms: 560 * MIN },
    { id: "goal-0", name: first, color: goalColor(0).fill, ms: 390 * MIN },
  ];
  if (second) {
    segs.push({ id: "goal-1", name: second, color: goalColor(1).fill, ms: 180 * MIN });
  }
  segs.push(
    { id: "gym", name: "Gym", color: PALETTE[6].fill, ms: 255 * MIN },
    { id: "reading", name: "Reading", color: PALETTE[3].fill, ms: 130 * MIN }
  );
  return segs.sort((a, b) => b.ms - a.ms);
}

// Beat 3's nudge card line (R:125, P:1098): the first habit if one was picked.
// This is the activity card, not Screen 3's habitNudgeText.
export function introNudgeLine(firstHabit: string | null | undefined): string {
  const habit = firstHabit?.trim();
  return habit ? `“${habit}” is still open today` : "Still time to clock in today";
}

// ---- Screen 5: find your friends --------------------------------------------

// Screen 5's own words (R:130-132, R:141). `sub` and `note` are for someone
// who isn't a UW student, or while UW is off; `uwSub` and `early` are a UW
// student's (P9d), and lib/uw-groups.ts's findFriendsView picks between them.
// The search, row and invite tile copy is shared with the Friends tab and
// lives in lib/find-friends.ts; the UW groups' headers in lib/uw-groups.ts.
export const FIND_FRIENDS_COPY = {
  title: "Find your friends",
  sub: "Your feed is your friends clocking in. Bring yours. It takes one message.",
  // Says outright that every suggestion is a UW student (owner, 2026-10-19):
  // the groups' headers only say "UW" on the last one.
  uwSub: "Your feed is your friends clocking in. Everyone suggested below is a UW student.",
  note: "Progra works best with people you already talk to. Here’s what your group chat gets:",
  early: "You’re early. No one from UW is on Progra yet. Send your link and they’ll show up here.",
  // The link card under the preview bubble (R:141). Its URL is the one
  // actually sent, the App Store listing (D9, APP_STORE_DISPLAY).
  linkTitle: "Join me on Progra",
} as const;

// Screen 5's CTA (R:143): the quiet "Skip for now" until someone's added, then
// the primary "Continue · {n} added". "added" reads the same for one or many.
export function friendsCta(added: number): { label: string; variant: "primary" | "secondary" } {
  const n = Math.max(0, Math.floor(added));
  return n > 0
    ? { label: `Continue · ${n} added`, variant: "primary" }
    : { label: "Skip for now", variant: "secondary" };
}

// The invite message (R:144, P:1157), message only. shareInvite/inviteBody
// (lib/invite-share.ts) put the link on the next line, and per D9 that link
// stays the App Store listing, not R's progra.world/i/{username}.
//
// The prototype falls back to an example goal when there's none. This text is
// a real message to real friends, so it never names a goal the sender didn't
// set. With no goal (the v3 Friends tab, for someone with no active goals) it
// says "my goals".
export function inviteText(goal: string | null | undefined): string {
  const title = goal?.trim();
  const what = title ? `“${title}”` : "my goals";
  return `I’m putting real time toward ${what} on Progra. Join so we can keep each other going.`;
}

// ---- Screen 6: ready --------------------------------------------------------

// The note under "Ready?" (R:151). `added` is how many people Screen 5 sent a
// request to, and `pending` is how many of those still haven't accepted.
// "Added" means a pending request (D13). While every one of them is still
// pending, the note says they'll see it once they accept, instead of claiming
// they'll see it now. Pluralized, so one person reads "The 1 friend" (P:1247).
export function readyNote(added: number, pending: number): string {
  const n = Math.max(0, Math.floor(added));
  if (n === 0) return "It lands in your feed the moment you clock in.";
  const who = `The ${n} ${n === 1 ? "friend" : "friends"} you added`;
  return Math.max(0, pending) >= n
    ? `${who} will see it once they accept.`
    : `${who} will see it in their feed.`;
}

// ---- The wizard -------------------------------------------------------------

export type UwChoice = "yes" | "no";
// Where the UW answer stands (OWNER-FIX-3: the question is a sheet over the
// welcome screen, not part of it). choose: the sheet's two tiles. selecting: a
// tile was tapped and is playing its selected state (No then saves and
// advances, Yes then opens). open: Yes became the bar, on the UW page with
// the majors/interests quick-add (OWNER-FIX-4: a full page, not the sheet).
export type UwPhase = "choose" | "selecting" | "open";

export type WizardState = {
  screen: number; // an index into V3_STEPS; see SCREEN
  // The UW sheet is up over the welcome screen (OWNER-FIX-3). It opens when
  // the welcome's Continue has saved the identity with UW on, closes when it's
  // dismissed unanswered, and is never up anywhere but Screen 1: every move
  // between screens closes it, so Back from Screen 2 lands on the welcome
  // with the sheet down. The answer it holds (uw, uwPhase, the lists, the
  // listing) outlives it, so the next Continue reopens it as it was left.
  uwSheet: boolean;
  // The UW page is in front on Screen 1 (OWNER-FIX-4): the owner asked for
  // the Yes path as a full page rather than inside the sheet. Yes opens it
  // (the sheet goes as it comes), Back from it is the welcome, Back from
  // Screen 2 lands on it while the answer is Yes, and the welcome's Continue
  // goes straight to it while the answer is Yes. Only ever true on Screen 1
  // with the answer open.
  uwPage: boolean;
  uw: UwChoice | null;
  uwPhase: UwPhase;
  majors: string[];
  interests: string[];
  // Whether the Yes path saves this student as listed in other students' UW
  // groups (plan D2, uw_listed). It turns true only when the Yes tile is
  // tapped, which is what puts the bar and its disclosure in front of them.
  // A replayer who starts on the open bar starts with what they have stored
  // (lib/onboarding-v3-uw.ts, uwStartState), so continuing past it never
  // lists someone who never opted in (the column defaults to false) or who
  // switched the listing off in Settings.
  uwListed: boolean;
  goals: string[];
  // Each goal's weekly hours (OWNER-FIX-2), by position: goalHours[i] is
  // goals[i]'s box. A replayer's stored quota is kept as stored until its box
  // is changed (goalHoursOrDefault).
  goalHours: number[];
  // The row each goal is saved on, by position, or null for one Continue
  // hasn't put on a row yet: the account's own goals' ids from the start
  // (prefillWizard), the row a typed title matched (the shell's
  // newGoalHours), and every row a save left a goal on (setGoalRowIds). Each
  // goal keeps its row however the titles around it change, so two goals
  // with the same or nearly the same title can never trade rows, or quotas,
  // between one Continue and the next (lib/onboarding-v3-goals-habits.ts,
  // matchGoals). No two goals hold the same row.
  //
  // goals, goalHours and goalRowIds are added, removed and set together, so
  // the three never misalign.
  goalRowIds: (string | null)[];
  habits: string[]; // selected, in pick order (habits[0] drives the nudge copy)
  customHabits: string[]; // chips added through "Your own", beyond V3_HABITS
  beat: number; // Screen 4's beat, 0..INTRO_BEATS-1
};

export type WizardAction =
  | { type: "go"; to: number }
  | { type: "back" }
  // The welcome's Continue, once the identity has saved, with UW on: the
  // sheet, or the UW page while the answer is already Yes.
  | { type: "openUwSheet" }
  // The sheet dismissed without an answer: the backdrop, a drag down or
  // Escape. The shell asks uwSheetDismissible first (lib/onboarding-v3-uw.ts).
  | { type: "closeUwSheet" }
  | { type: "pickUw"; choice: UwChoice }
  | { type: "openUw" }
  | { type: "changeUw" }
  | { type: "addMajor"; value: string }
  | { type: "removeMajor"; index: number }
  | { type: "addInterest"; value: string }
  | { type: "removeInterest"; index: number }
  // The quick-add's chip fields (components/v2/chip-field.tsx) hand back the
  // whole list after each change, already through the action's cleaner.
  | { type: "setMajors"; majors: readonly string[] }
  | { type: "setInterests"; interests: readonly string[] }
  // `hours` starts the new goal's box, or 5h, and `rowId` is the row it's
  // already on, if any: both from the shell's newGoalHours.
  | { type: "addGoal"; title: string; hours?: number; rowId?: string | null }
  | { type: "removeGoal"; index: number }
  | { type: "setGoalHours"; index: number; hours: number }
  // After a save, the row it left each goal on (useGoalWrites), for the
  // goals it saved. Anything else since and the ids are dropped, since they
  // describe a list that isn't there any more.
  | { type: "setGoalRowIds"; ids: readonly (string | null)[]; goals: readonly string[] }
  | { type: "toggleHabit"; name: string }
  | { type: "addCustomHabit"; name: string }
  | { type: "setBeat"; beat: number }
  | { type: "nextBeat" }
  | { type: "prevBeat" };

export function initialWizardState(): WizardState {
  return {
    screen: SCREEN.identity,
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
    habits: [],
    customHabits: [],
    beat: 0,
  };
}

// The UW answer as the sheet should show it the next time it's in front, the
// prototype's go() rules for coming back to it (P:855-864):
//   - after "No", the tiles ask again (R:176) instead of showing a stale
//     selection;
//   - mid-"Yes", the open quick-add, not a tile frozen mid-animation.
// Majors and interests survive the No reset, as they survive the bar's Change
// (P:816), so changing your mind back to Yes finds them still there.
function settleUw(state: WizardState): WizardState {
  if (state.uw === "no") return { ...state, uw: null, uwPhase: "choose" };
  if (state.uw === "yes" && state.uwPhase === "selecting") return { ...state, uwPhase: "open" };
  return state;
}

// The answer is Yes, and open: what the UW page shows.
function isUwOpen(state: WizardState): boolean {
  return state.uw === "yes" && state.uwPhase === "open";
}

// Screen 1 as it's arrived at: on the UW page while the answer is Yes.
function withUwPage(state: WizardState): WizardState {
  const uwPage = isUwOpen(state);
  return uwPage === state.uwPage ? state : { ...state, uwPage };
}

// Move to a screen. Any move takes the UW sheet down (it belongs to the
// welcome screen alone), and:
//   - coming back to Screen 1 settles the UW answer (settleUw), for the sheet
//     the next Continue opens, and lands on the UW page while it's Yes, the
//     page Screen 2 was reached from;
//   - entering Screen 4 restarts the intro at beat 1 (P:861), however you got
//     there.
function go(state: WizardState, to: number): WizardState {
  if (!Number.isFinite(to)) return state;
  const screen = Math.min(Math.max(0, Math.floor(to)), SCREEN_COUNT - 1);
  if (screen === state.screen) return state;
  const moved: WizardState = { ...state, screen, uwSheet: false, uwPage: false };
  const next = screen === SCREEN.identity ? withUwPage(settleUw(moved)) : moved;
  if (screen === SCREEN.intro) next.beat = 0;
  return next;
}

// A list with `value` appended, unless it's empty, already there (by
// normalizeMatchText, so "economics" doesn't sit beside "Economics"), or the
// list is full. The SAME array comes back when nothing changes, so the reducer
// can return the same state and React skips the render.
function appendCapped(
  list: string[],
  value: string | null,
  max: number
): string[] {
  if (!value || list.length >= max) return list;
  const key = normalizeMatchText(value);
  if (list.some((x) => normalizeMatchText(x) === key)) return list;
  return [...list, value];
}

// `list` as `clean` stores it, or the same array when that's what's held
// already, so a chip field reporting an unchanged list doesn't re-render.
function replaceList(
  current: string[],
  list: readonly string[],
  clean: (values: unknown) => string[]
): string[] {
  const next = clean(list);
  return next.length === current.length && next.every((x, i) => x === current[i])
    ? current
    : next;
}

function removeAt<T>(list: T[], index: number): T[] {
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// Not for goals, which change only together with their hours and rows.
function withList<K extends "majors" | "interests">(
  state: WizardState,
  key: K,
  list: string[]
): WizardState {
  return list === state[key] ? state : { ...state, [key]: list };
}

// Screen 1's identity fields (name, handle, photo) are NOT here. They're the
// welcome screen's (app/onboarding/v3/welcome-screen.tsx), saved by its
// Continue. This reducer holds what the screens share and the rules for
// moving between them. Every action that changes nothing returns the same
// state object.
export function wizardReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "go":
      return go(state, action.to);
    case "back":
      // Screen 1 has no Back (R:35), except from the UW page, to the welcome.
      if (state.screen > 0) return go(state, state.screen - 1);
      return state.uwPage ? { ...state, uwPage: false } : state;

    case "openUwSheet":
      // Only over the welcome screen. An answer left mid-animation (which a
      // sheet that can't be dismissed then shouldn't leave) settles first.
      if (state.screen !== SCREEN.identity || state.uwSheet || state.uwPage) return state;
      {
        const settled = settleUw(state);
        return isUwOpen(settled) ? { ...settled, uwPage: true } : { ...settled, uwSheet: true };
      }
    case "closeUwSheet":
      // Not while a tile plays its selected state: No is saving and moving
      // on, and Yes is about to open. The rest of the answer stays as it was.
      if (!state.uwSheet || state.uwPhase === "selecting") return state;
      return { ...state, uwSheet: false };

    case "pickUw":
      // Only from the tiles of a sheet that's up, so a second tap during the
      // selected-state animation can't switch the answer (P:791-801). Yes is
      // the tap that opens the bar with its disclosure, so it's the one that
      // lists (D2). No leaves the flag alone: leaving the cohort unlists anyway
      // (uwProfilePayload), whatever this says.
      if (state.screen !== SCREEN.identity || !state.uwSheet || state.uwPhase !== "choose") {
        return state;
      }
      return {
        ...state,
        uw: action.choice,
        uwPhase: "selecting",
        uwListed: action.choice === "yes" ? true : state.uwListed,
      };
    case "openUw":
      // The Yes tile has finished its selected state: the sheet goes, and the
      // UW page comes with the bar, the tile morphing into it.
      if (state.uw !== "yes" || state.uwPhase !== "selecting") return state;
      return {
        ...state,
        uwPhase: "open",
        uwSheet: false,
        uwPage: state.screen === SCREEN.identity,
      };
    case "changeUw":
      // The bar's "Change" (R:80, P:816), on the UW page: the question again,
      // the sheet back up over the welcome.
      if (state.uw === null && state.uwPhase === "choose") return state;
      return {
        ...state,
        uw: null,
        uwPhase: "choose",
        uwPage: false,
        uwSheet: state.screen === SCREEN.identity,
      };

    case "addMajor":
      // Canonicalized to the known list's spelling when it's on it (R:85),
      // through the same cleanMajor the server uses.
      return withList(
        state,
        "majors",
        appendCapped(state.majors, cleanMajor(action.value), MAX_UW_MAJORS)
      );
    case "removeMajor":
      return withList(state, "majors", removeAt(state.majors, action.index));
    case "addInterest":
      // Free text kept as typed, apart from whitespace (R:87). Per-item length
      // is the field's maxLength and P9a's server cleaner, not this.
      return withList(
        state,
        "interests",
        appendCapped(
          state.interests,
          action.value.trim().replace(/\s+/g, " "),
          MAX_UW_INTERESTS
        )
      );
    case "removeInterest":
      return withList(state, "interests", removeAt(state.interests, action.index));
    case "setMajors":
      return withList(state, "majors", replaceList(state.majors, action.majors, cleanMajors));
    case "setInterests":
      return withList(
        state,
        "interests",
        replaceList(state.interests, action.interests, cleanInterests)
      );

    case "addGoal": {
      // At most MAX_GOALS (R:95). Unlike majors, two identical goals are not
      // merged (P:918-924), so typing one twice shows it twice. That is what
      // the person typed, and they can remove one. Its hours come in beside
      // it, as given, so a quota the box can't set itself survives, and so
      // does its row, unless another goal already holds that one.
      const title = formatGoalTitle(action.title);
      if (!title || state.goals.length >= MAX_GOALS) return state;
      const { rowId } = action;
      const held = typeof rowId === "string" && rowId !== "" && !state.goalRowIds.includes(rowId);
      return {
        ...state,
        goals: [...state.goals, title],
        goalHours: [...state.goalHours, goalHoursOrDefault(action.hours)],
        goalRowIds: [...state.goalRowIds, held ? rowId : null],
      };
    }
    case "removeGoal": {
      const goals = removeAt(state.goals, action.index);
      if (goals === state.goals) return state;
      return {
        ...state,
        goals,
        goalHours: removeAt(state.goalHours, action.index),
        goalRowIds: removeAt(state.goalRowIds, action.index),
      };
    }
    case "setGoalRowIds": {
      // Only for the list that was saved, and one id per goal. A row named
      // twice stays with the first goal that names it.
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
    case "setGoalHours": {
      // A box's −, + or typed hours (OWNER-FIX-2): whole hours, 1–40. A bad
      // index, something that isn't a number, or the hours it already has
      // change nothing.
      const at = action.index;
      const hours = clampGoalHours(action.hours);
      if (!Number.isInteger(at) || at < 0 || at >= state.goals.length || hours === null) {
        return state;
      }
      if (state.goalHours[at] === hours) return state;
      return { ...state, goalHours: state.goalHours.map((h, i) => (i === at ? hours : h)) };
    }

    case "toggleHabit": {
      const on = state.habits.includes(action.name);
      return {
        ...state,
        habits: on
          ? state.habits.filter((h) => h !== action.name)
          : [...state.habits, action.name],
      };
    }
    case "addCustomHabit": {
      // Return in "Your own" adds the chip AND selects it (R:102). Typing a
      // habit that already has a chip selects that chip instead of adding a
      // near-twin. The prototype matches exact strings, and this ignores case.
      const name = formatHabitName(action.name);
      if (!name) return state;
      const key = normalizeMatchText(name);
      const existing = [...V3_HABITS, ...state.customHabits].find(
        (h) => normalizeMatchText(h) === key
      );
      const label = existing ?? name;
      const customHabits = existing ? state.customHabits : [...state.customHabits, name];
      const habits = state.habits.includes(label) ? state.habits : [...state.habits, label];
      if (customHabits === state.customHabits && habits === state.habits) return state;
      return { ...state, customHabits, habits };
    }

    // The beat actions only act while Screen 4 is showing, so a stale arrow-key
    // or swipe handler can't move the beat, or jump to Screen 5, from anywhere
    // else (the prototype guards its key handler the same way, P:1028).
    case "setBeat": {
      if (state.screen !== SCREEN.intro || !Number.isFinite(action.beat)) return state;
      const beat = Math.min(Math.max(0, Math.floor(action.beat)), INTRO_BEATS - 1);
      return beat === state.beat ? state : { ...state, beat };
    }
    case "nextBeat":
      // The CTA and a right-side tap: the next beat, or on from the last one
      // to Screen 5 (P:1035). There is no auto-advance (R:107).
      if (state.screen !== SCREEN.intro) return state;
      return state.beat < INTRO_BEATS - 1
        ? { ...state, beat: state.beat + 1 }
        : go(state, SCREEN.friends);
    case "prevBeat":
      // From beat 1 there's nowhere to go. The screen bumps the panel
      // instead (R:127), which it can tell from `beat === 0` before dispatching.
      if (state.screen !== SCREEN.intro) return state;
      return state.beat > 0 ? { ...state, beat: state.beat - 1 } : state;
  }
}
