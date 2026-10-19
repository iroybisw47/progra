// Onboarding v3's Screen 4, "What is Progra" (design_handoff_progra_step04):
// a practice run of the real loop. The person reads what Progra is over a
// preview of the Progress tab, clocks in on their own goal, watches 25 fast-
// forwarded minutes run out, posts, and sees the post as their friends will.
// The parts here are the ones that can be wrong without a device: the
// timer's curve, which pose every element rests in for each phase, the CTA,
// the copy and the illustrative week. app/onboarding/v3/practice-screen.tsx
// renders them.
//
// Nothing about the run is logged (the timer never touches a session). The
// post is the "just joined Progra" card friends already get from
// onboarded_at, plus the photo picked here (app/actions/join-photo.ts).

import type { Habit, HabitCompletion } from "@/lib/db/habits";
import type { ItemPhase } from "@/lib/motion";
import {
  GOAL_EXAMPLES,
  PRACTICE_PHASES,
  goalColor,
  isPracticePhase,
  type PracticePhase,
} from "@/lib/onboarding-v3";
import { PALETTE } from "@/lib/palette";
import type { QuotaGoal } from "@/components/v2/goal-quota-rows";

// ---- Phases -------------------------------------------------------------------

// Screen 4's six phases live with the reducer that holds the current one.
export { PRACTICE_PHASES, isPracticePhase, type PracticePhase };

function order(phase: PracticePhase): number {
  return PRACTICE_PHASES.indexOf(phase);
}

// The pose of an element shown in the phases `shownIn`: active while Screen 4
// is in front on one of them, past once the screen has gone on beyond the
// last of them (it exited up), ahead otherwise (it waits below). Leaving
// Screen 4 forward takes everything past with it, and Back everything ahead.
export function practicePose(
  screen: ItemPhase,
  demo: PracticePhase,
  shownIn: readonly PracticePhase[]
): ItemPhase {
  if (screen !== "active") return screen;
  if (shownIn.includes(demo)) return "active";
  const last = Math.max(...shownIn.map(order));
  return order(demo) > last ? "past" : "ahead";
}

// How the run ended: on its own at 25 minutes, or by "Clock out" before then.
export type PracticeEnd = "auto" | "early";

// ---- The timer ----------------------------------------------------------------

// The run's length: 25 minutes, in simulated seconds.
export const PRACTICE_SECS = 25 * 60;

// The first second runs at true speed, so it reads as a real timer. Then the
// rest of the 25 minutes is fast-forwarded over 3.4s on a cubic in-out.
export const PRACTICE_REALTIME_MS = 1000;
export const PRACTICE_FAST_MS = 3400;

// Under reduced motion it steps in whole five minutes every 500ms instead,
// and is done at 2.8s.
export const PRACTICE_REDUCED_STEP_MS = 500;
export const PRACTICE_REDUCED_STEP_SECS = 5 * 60;
export const PRACTICE_REDUCED_DONE_MS = 2800;

// The fast-forward chip comes in this long after Clock in.
export const PRACTICE_FF_CHIP_MS = 900;

function cubicInOut(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

// The simulated seconds `elapsedMs` of real time after Clock in, and whether
// the run is over (the timer clocks them out at 25:00).
export function simSeconds(elapsedMs: number, reduced: boolean): { sim: number; done: boolean } {
  const ms = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  if (reduced) {
    const steps = Math.floor(ms / PRACTICE_REDUCED_STEP_MS);
    const done = ms >= PRACTICE_REDUCED_DONE_MS;
    return {
      sim: done ? PRACTICE_SECS : Math.min(PRACTICE_SECS, steps * PRACTICE_REDUCED_STEP_SECS),
      done,
    };
  }
  if (ms < PRACTICE_REALTIME_MS) return { sim: ms / 1000, done: false };
  const p = Math.min(1, (ms - PRACTICE_REALTIME_MS) / PRACTICE_FAST_MS);
  return { sim: 1 + (PRACTICE_SECS - 1) * cubicInOut(p), done: p >= 1 };
}

// Where "Clock out" freezes the timer: the whole simulated second, and never
// 0:00:00, so an instant tap still reads as a run.
export function earlySeconds(sim: number): number {
  return Math.min(PRACTICE_SECS, Math.max(1, Math.floor(Number.isFinite(sim) ? sim : 0)));
}

// H:MM:SS, as the live timer's 52px clock reads.
export function formatPracticeClock(secs: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(secs) ? secs : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---- Copy (verbatim from the handoff, "Lets" included) ------------------------

export const PRACTICE_COPY = {
  heading: "What is Progra?",
  lead: "Progra is a productivity app designed to be used with your friends!",
  body: "You clock in hours towards goals, or anything you want to keep track of/post, and friends can see your posts on a shared feed!",
  start: "Lets start with an example.",
  goalSub: "Goal · 0h this week",
  timer: "25 min",
  practiceRun: "PRACTICE RUN",
  fastForward: "Fast-forwarding 25 minutes",
  postHeading: "This is just practice, but will be your first post, so feel free to post anything!",
  addPhoto: "Add a photo",
  addPhotoHint: "Your desk, your notes, the view",
  change: "Change",
  postWithout: "Post without a photo",
  joined: "just joined Progra, and their first goal is",
  justNow: "just now",
  posted: "Posted. Next, add the friends who'll see it in their feed.",
} as const;

// Whether the run has stopped: the timer reads its final time from here on,
// and the eyebrow and the line under it say how it stopped.
export function practiceStopped(demo: PracticePhase): boolean {
  return order(demo) >= order("ended");
}

// The eyebrow's label over the timer. It keeps its stopped wording while it
// exits, rather than flicking back to "Clocked in".
export function liveLabel(demo: PracticePhase, end: PracticeEnd | null): string {
  if (!practiceStopped(demo)) return "Clocked in";
  return end === "early" ? "Clocked out" : "Timer done";
}

// The line under the timer once it's stopped.
export function endedStatus(end: PracticeEnd | null, secs: number): string {
  if (end !== "early") return "25 minutes done. Your timer clocked you out.";
  return `Clocked out at ${Math.max(1, Math.round(secs / 60))}m.`;
}

// ---- The CTA -----------------------------------------------------------------

export type PracticeCta = { label: string; variant: "primary" | "secondary" };

// The one CTA under Screen 4, by phase. "Clock out" is the outlined
// secondary. On the post phase it opens the picker until a photo is picked,
// then posts it.
export function practiceCta(demo: PracticePhase, hasPhoto: boolean): PracticeCta {
  switch (demo) {
    case "intro":
      return { label: "Start the example", variant: "primary" };
    case "ready":
      return { label: "Clock in", variant: "primary" };
    case "running":
      return { label: "Clock out", variant: "secondary" };
    case "post":
      return { label: hasPhoto ? "Post" : "Add a photo", variant: "primary" };
    case "ended":
    case "posted":
      return { label: "Continue", variant: "primary" };
  }
}

// ---- The goal ----------------------------------------------------------------

export type PracticeGoal = { title: string; color: string };

// The goals the ready phase lists, in the colors Screen 2 drew them in. By
// Screen 4 there's always one, since Screen 2 won't continue without it; the
// fallback only keeps a bad call drawing something sensible.
export function practiceGoals(
  goals: readonly string[],
  colors: readonly string[]
): PracticeGoal[] {
  const list = goals.map((g) => g.trim()).filter(Boolean);
  const titles = list.length > 0 ? list : [GOAL_EXAMPLES[0]];
  return titles.map((title, i) => ({ title, color: colors[i] || goalColor(i).fill }));
}

// "PICK ONE" over the rows only when there's a choice to make.
export function pickMeta(goalCount: number): string | undefined {
  return goalCount > 1 ? "PICK ONE" : undefined;
}

// ---- The hero preview (illustrative, not the person's data) ------------------

const MIN = 60_000;
const HOUR = 60 * MIN;

// A fixed Monday-to-Sunday week, with Friday as today. The grid only draws
// letters and squares, so the dates themselves never show.
const HERO_WEEK_START = "2026-10-12";
const HERO_TODAY = "2026-10-16";
const HERO_DONE: readonly (readonly string[])[] = [
  ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16"],
  ["2026-10-12", "2026-10-14", "2026-10-15", "2026-10-16"],
];
const HERO_HABIT_FALLBACK = ["Drink water", "Stretch"] as const;
const HERO_HABIT_COLORS = [PALETTE[4].fill, PALETTE[6].fill] as const;

export type HeroSample = {
  segments: { color: string; value: number }[];
  total: string;
  goals: QuotaGoal[];
  habits: Habit[];
  completions: HabitCompletion[];
  weekStart: string;
  today: string;
};

// "11h 40m", "45m".
export function formatHoursMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h ? `${h}h ${String(rest).padStart(2, "0")}m` : `${rest}m`;
}

// The Progress-tab preview over the intro: a week's wheel, one goal's quota
// and the first two habits Screen 3 picked (or two stand-ins), with made-up
// check-offs.
export function heroSample(habits: readonly string[]): HeroSample {
  const segments = [
    { color: PALETTE[7].fill, value: 390 },
    { color: PALETTE[2].fill, value: 180 },
    { color: PALETTE[9].fill, value: 130 },
  ];
  const minutes = segments.reduce((sum, s) => sum + s.value, 0);
  const picked = habits.map((h) => h.trim()).filter(Boolean);
  const names = (picked.length > 0 ? picked : HERO_HABIT_FALLBACK).slice(0, 2);
  const heroHabits: Habit[] = names.map((name, i) => ({
    id: `hero-habit-${i}`,
    name,
    color: HERO_HABIT_COLORS[i],
    createdAt: 0,
    archivedAt: null,
    isPrivate: false,
  }));
  return {
    segments,
    total: formatHoursMinutes(minutes),
    goals: [
      { id: "hero-goal", title: "Study", color: PALETTE[7].fill, quotaHours: 10, actualMs: 6.5 * HOUR },
    ],
    habits: heroHabits,
    completions: heroHabits.flatMap((h, i) =>
      HERO_DONE[i].map((completedOn) => ({ id: `${h.id}:${completedOn}`, habitId: h.id, completedOn }))
    ),
    weekStart: HERO_WEEK_START,
    today: HERO_TODAY,
  };
}
