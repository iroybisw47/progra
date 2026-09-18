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
  "friends",
] as const;
export type Step = (typeof STEPS)[number];

// `notify` is native-only — there are no notifications on the website — so the
// live list is computed per render and is what everything reads. Never index
// STEPS directly: on web the arrays differ in length, and the dots, the "step N
// of M" eyebrow and the bounds clamp would all disagree with each other.
export function activeSteps(native: boolean): readonly Step[] {
  return native ? STEPS : STEPS.filter((s) => s !== "notify");
}

// "Step 3 of 7 · Practice". Welcome isn't numbered; on the web it's "of 6".
export function eyebrowFor(step: Step, steps: readonly Step[]): string | null {
  if (step === "welcome") return null;
  const numbered = steps.filter((s) => s !== "welcome");
  const practice = step === "clock" || step === "post";
  return `Step ${numbered.indexOf(step) + 1} of ${numbered.length}${practice ? " · Practice" : ""}`;
}

export const DEFAULT_GOAL_COLOR = PALETTE[7].fill; // Dark blue

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
