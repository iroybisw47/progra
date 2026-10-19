// The onboarding wizard's pure parts: the step list, the copy it composes from
// what the user entered, and the practice clock-in's fast-forward curve. Kept
// out of the client component so they're testable and so the shell reads as
// a state machine rather than a pile of string templates.

import { PALETTE } from "@/lib/palette";

export const STEPS = [
  "welcome",
  "how",
  "goal",
  "habit",
  "clock",
  "notify",
  "post",
  "uw",
  "friends",
] as const;
export type Step = (typeof STEPS)[number];

// Two steps are conditional, so the live list is computed per render and is
// what everything reads. Never index STEPS directly: the arrays differ in
// length, and the dots, the "step N of M" eyebrow and the bounds clamp would
// all disagree with each other.
//
//   notify — native-only; there are no notifications on the website.
//   uw     — only for a student who ticked "I'm a UW student" on `welcome`.
//            The tick is gone (plan P9a): v2 always passes false, and the
//            parameter goes with v2 itself in P11.
//
// BOTH predicates resolve while the user is still on `welcome` at index 0,
// which is the load-bearing reason a list that changes length underneath
// stepIndex is safe: it can never shift a step the user is partway through.
// `native` flips once just after hydration; the UW tick is on welcome itself.
// Asking the UW question any later would renumber the eyebrow mid-flow.
//
// `uw` sits after `goal` — goal titles are one of the three match signals, so
// the goal has to exist first — and before `friends`, which shows the peers it
// makes findable.
export function activeSteps(native: boolean, uw: boolean): readonly Step[] {
  return STEPS.filter((s) => (s !== "notify" || native) && (s !== "uw" || uw));
}

// "Step 3 of 7 · Practice". Welcome isn't numbered; on the web it's "of 6".
export function eyebrowFor(step: Step, steps: readonly Step[]): string | null {
  if (step === "welcome") return null;
  const numbered = steps.filter((s) => s !== "welcome");
  const practice = step === "clock" || step === "post";
  return `Step ${numbered.indexOf(step) + 1} of ${numbered.length}${practice ? " · Practice" : ""}`;
}

// Onboarding v3's seven screens, named with the step names analytics already
// accepts: the prod CHECK on profiles.onboarding_step and the event allowlist
// both list exactly STEPS (.claude/plans/analytics/phase1.sql), so reusing
// them is what lets v3 report without any SQL. Each screen takes the v2 step
// closest to its job:
//
//   welcome  1 · who you are: name, handle, photo (and the UW question)
//   goal     2 · up to three goals
//   habit    3 · habits
//   how      4 · the three-beat intro to what Progra is
//   friends  5 · find your friends
//   notify   6 · turn on notifications (in the app, while iOS can still ask)
//   clock    7 · "Ready?", then the real Clock tab
//
// The ORDER is v3's own: `how` moves from second to fourth. Anything that
// infers "reached step N" from a position has to use the list for the flow it
// is counting. v2's practice `post` and its separate uw step have no v3
// screen. `notify` is stepped over wherever it can't ask (the website, or a
// device that has already answered; lib/onboarding-v3.ts, notifyScreenShown),
// so a run can skip from friends straight to clock.
export const V3_STEPS = [
  "welcome",
  "goal",
  "habit",
  "how",
  "friends",
  "notify",
  "clock",
] as const satisfies readonly Step[];
export type V3Step = (typeof V3_STEPS)[number];

export const DEFAULT_GOAL_COLOR = PALETTE[7].fill; // Dark blue

// The weekly quota a goal made in onboarding starts with. Since OWNER-FIX-2
// it seeds each of v3's Screen 2 hours boxes, which the person can change
// before Continue (lib/onboarding-v3.ts, goalHoursOrDefault), and it's v2's
// default too, so a goal nobody adjusts lands on Progress as a v2 one does.
// createGoal rejects anything that isn't positive, so it always needs a
// value. Editable on the Goals page like any other quota.
export const DEFAULT_GOAL_QUOTA_HOURS = 5;

export type HabitPick = { name: string; color: string };

export const HABIT_PRESETS: readonly HabitPick[] = [
  { name: "Journaling", color: PALETTE[9].fill },
  { name: "Meditation", color: PALETTE[6].fill },
  { name: "Stretching", color: PALETTE[5].fill },
  { name: "Drinking water", color: PALETTE[7].fill },
];

// The colour a custom habit gets: the presets' palette, cycling.
export function nextHabitColor(count: number): string {
  return HABIT_PRESETS[count % HABIT_PRESETS.length].color;
}

export function goalDisplay(title: string): string {
  return title.trim() || "your first goal";
}

// ", plus journaling, meditation every day" — or nothing.
export function habitPhrase(habits: readonly HabitPick[]): string {
  if (habits.length === 0) return "";
  return `, plus ${habits.map((h) => h.name.toLowerCase()).join(", ")} every day`;
}

export function inviteMessage(input: {
  hours: number;
  goalTitle: string;
  habits: readonly HabitPick[];
}): string {
  return `I'm putting ${input.hours} hours into “${goalDisplay(input.goalTitle)}” this week on Progra${habitPhrase(input.habits)}. Join me and hold me accountable.`;
}

export function doneSummary(input: {
  hours: number;
  goalTitle: string;
  habits: readonly HabitPick[];
}): string {
  return `Your week starts now: ${input.hours}h on “${goalDisplay(input.goalTitle)}”${habitPhrase(input.habits)}. Your friends will see how it goes.`;
}

// Avatar initials: first letters of the first two words of the name, else the
// first two characters of the name or username, uppercased.
export function initialsFor(name: string, username: string): string {
  const n = name.trim();
  if (n) {
    const words = n.split(/\s+/);
    return (words.length >= 2 ? words[0][0] + words[1][0] : n.slice(0, 2)).toUpperCase();
  }
  const u = username.trim();
  return u ? u.slice(0, 2).toUpperCase() : "?";
}

// The practice clock-in: the first 1.5s tick at true speed, so it reads as a
// real timer, then an eased (quadratic) fast-forward to the 25-minute target
// over 1.8s. Returns the simulated elapsed ms for a real elapsed ms.
export const SIM_TARGET_MS = 25 * 60_000;
export const SIM_REALTIME_MS = 1_500;
export const SIM_FAST_MS = 1_800;
export const SIM_TOTAL_MS = SIM_REALTIME_MS + SIM_FAST_MS;

export function clockSimValue(realMs: number): number {
  if (realMs < SIM_REALTIME_MS) return realMs;
  const p = Math.min(1, (realMs - SIM_REALTIME_MS) / SIM_FAST_MS);
  return Math.min(SIM_TARGET_MS, SIM_REALTIME_MS + p * p * (SIM_TARGET_MS - SIM_REALTIME_MS));
}

// m:ss for the practice timer.
export function formatSim(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
