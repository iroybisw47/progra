// Onboarding v3's Screen 4, "What Progra is" (R:106-127, plan P5): the parts
// that can be wrong without a device. Which way a tap or a swipe moves the
// beats, which pose each beat's elements rest in, what the caption says around
// goal 1, whose week Beat 2 draws, and Beat 3's four cards. Pure, like
// lib/onboarding-v3.ts, which it builds on. app/onboarding/v3/intro-screen.tsx
// renders it.
//
// "R:<line>" and "P:<line>" cite the design handoff, as the plan does.

import { entityInk, tint } from "@/lib/colors";
import type { ItemPhase } from "@/lib/motion";
import {
  GOAL_EXAMPLES,
  INTRO_BEATS,
  INTRO_CAPTIONS,
  goalColor,
  introNudgeLine,
  introSegments,
} from "@/lib/onboarding-v3";
import { PALETTE } from "@/lib/palette";

// ---- Moving between beats (R:126) ----------------------------------------------

// A swipe has to travel further than this, and further across than down
// (R:126, P:1046). The recap story pages on the same rule
// (app/recap/[weekStart]/recap-story.tsx).
export const SWIPE_MIN_PX = 36;

// How far a press may wander and still count as a tap. The prototype counts
// anything short of a swipe as a tap at wherever it was let go (P:1047-1048),
// so a 30px drag to the right that started on the right of the panel went
// FORWARD, the opposite of what the hand meant. Past this it's a gesture that
// didn't finish, and it does nothing.
export const TAP_SLOP_PX = 10;

export type BeatMove = "next" | "prev" | null;

// What a press on the preview panel does, from where it went down to where it
// came up. A horizontal swipe pages (left is next, as a story does). A tap
// pages by where it lands: the left third goes back, the rest goes on (R:126).
// `x` is where the press came up, from the panel's left edge, and `width` the
// panel's width. A vertical drag never reaches here on a phone: the panel is
// `touch-action: pan-y`, so the browser takes it and fires pointercancel.
export function beatMove({
  dx,
  dy,
  x,
  width,
}: {
  dx: number;
  dy: number;
  x: number;
  width: number;
}): BeatMove {
  if (![dx, dy, x, width].every(Number.isFinite)) return null;
  const across = Math.abs(dx);
  if (across > SWIPE_MIN_PX && across > Math.abs(dy)) return dx < 0 ? "next" : "prev";
  if (Math.hypot(dx, dy) > TAP_SLOP_PX) return null;
  return x < width / 3 ? "prev" : "next";
}

// ---- Poses ------------------------------------------------------------------------

// The pose of beat `k`'s caption and content (P:1068, P:1079): active while
// Screen 4 is in front showing that beat, past once the beat has been left
// forward (it exited up), ahead otherwise (it waits below, which is also
// where a beat left by going back returns to). The screen's own pose only
// decides whether anything is active: leaving Screen 4 forward takes the
// current beat out downward with the panel going up, as the prototype does,
// and the panel's own exit carries it.
export function beatPhase(k: number, beat: number, screen: ItemPhase): ItemPhase {
  if (screen === "active" && k === beat) return "active";
  return k < beat ? "past" : "ahead";
}

// How full beat-progress segment `k` is (R:107, P:1066): every segment up to
// and including the current beat while the intro is showing, all of them once
// it's been left forward, none before it's reached.
export function beatSegmentFill(k: number, beat: number, screen: ItemPhase): 0 | 1 {
  if (screen === "past") return 1;
  if (screen === "ahead") return 0;
  return k <= beat ? 1 : 0;
}

// The CTA under the intro (R:126): "Next" through the beats, "Continue" on
// the last, which goes on to Screen 5.
export function introCtaLabel(beat: number): "Next" | "Continue" {
  return beat < INTRO_BEATS - 1 ? "Next" : "Continue";
}

// ---- Goal 1 -------------------------------------------------------------------

export type IntroGoal = {
  title: string;
  color: string; // the square, the marker and the donut segment
  ink: string; // the duration pill's text (R:113)
  wash: string; // the duration pill's fill: the color at 14% (R:113)
};

// Goal 1 as the intro draws it, in the color Screen 2 showed it in
// (`colors`, goalColors' from lib/onboarding-v3-goals-habits.ts), so a
// replayer's own goal keeps its own color. By Screen 4 there is always a goal,
// because Screen 2 won't continue without one. The fallback is the
// prototype's (P:736, the first example in palette 7), the same one
// introSegments uses, so a preview with no goal still reads as a sentence.
export function introGoal(goals: readonly string[], colors: readonly string[]): IntroGoal {
  const title = goals[0]?.trim() || GOAL_EXAMPLES[0];
  const color = colors[0] || goalColor(0).fill;
  return { title, color, ink: entityInk(color), wash: tint(color, 0.14) };
}

// ---- Captions (R:108-111) ---------------------------------------------------------

// A beat's caption in the parts it's drawn in. Beat 1's wraps goal 1, which
// is drawn after a 10px square in its color (R:109). The square and the whole
// title stay on one line, as the prototype's do (P:219). Only when that run is
// wider than the caption (a long goal on a narrow phone) does the screen let
// the `tail` wrap, keeping the square with the `head`, the first word, so the
// goal can't push the caption off the side of the screen.
export type IntroCaption = {
  before: string;
  goal: { head: string; tail: string } | null;
  after: string;
};

export function introCaption(beat: number, goalTitle: string): IntroCaption {
  if (beat <= 0) {
    const title = goalTitle.trim().replace(/\s+/g, " ");
    const gap = title.indexOf(" ");
    return {
      before: INTRO_CAPTIONS.feed[0],
      goal: gap < 0 ? { head: title, tail: "" } : { head: title.slice(0, gap), tail: title.slice(gap) },
      after: INTRO_CAPTIONS.feed[1],
    };
  }
  return {
    before: beat === 1 ? INTRO_CAPTIONS.hours : INTRO_CAPTIONS.friends,
    goal: null,
    after: "",
  };
}

// The caption as one string.
export function introCaptionText(caption: IntroCaption): string {
  const goal = caption.goal ? caption.goal.head + caption.goal.tail : "";
  return caption.before + goal + caption.after;
}

// What the live region reads out as each beat arrives: where it is, since the
// progress segments are drawn for sight only, then the caption.
export function introAnnouncement(beat: number, goalTitle: string): string {
  const k = Math.min(INTRO_BEATS - 1, Math.max(0, Math.floor(beat)));
  return `${k + 1} of ${INTRO_BEATS}. ${introCaptionText(introCaption(k, goalTitle))}`;
}

// What assistive tech hears in place of the panel. Its people, posts and
// kudos are made up, so they're hidden from it and summed up as an example
// instead, except a replayer's real week (`sample` false), which is theirs
// and is read as it is.
export function introSummary(beat: number, sample: boolean): string {
  if (beat <= 0) return "Example: your session in a friend's feed, with kudos from three friends.";
  if (beat === 1) {
    return sample
      ? "Example: a week of tracked hours, split by category."
      : "Your tracked hours this week, by category:";
  }
  return "Example: friends liking and commenting on your sessions, nudging you, and clocking in.";
}

// ---- Beat 1: the feed post (R:113) ----------------------------------------------

// The sample post's numbers. "Day one" is its title.
export const SAMPLE_POST = { duration: "1h 20m", when: "just now", title: "Day one", kudos: 3 } as const;

// The three friends whose avatars spring in under the post, and the line that
// follows them (P:1081). Zack has no display name in the prototype, so his
// avatar shows his handle's initials.
export const KUDOS_FRIENDS = [
  { name: null, username: "zack" },
  { name: "Priya Raman", username: "priya.r" },
  { name: "Leo Martins", username: "leo.m" },
] as const;
export const KUDOS_LINE = "Zack, Priya and Leo gave you kudos";

// The avatars sit 20px apart, overlapping (R:113).
export const KUDOS_OFFSET_PX = 20;

// ---- Beat 2: hours by category (R:114-121) ---------------------------------------

// One donut segment, shaped for CategoryDonut's `segs` (its CatSeg).
export type WeekSeg = { id?: string | null; name: string; color: string; ms: number };

export type IntroWeek = {
  segs: WeekSeg[];
  totalMs: number;
  // True when this is the illustrative split rather than the person's week.
  sample: boolean;
};

// Whose week Beat 2 draws (D15, R:121). Someone who has tracked time this
// week sees their own categories (`real`, read server-side by
// app/onboarding/page.tsx exactly as the Week tab's donut reads them),
// largest first. Everyone else, which is every first run, sees the README's
// sample: Schoolwork, goal 1, goal 2 if there is one, Gym and Reading
// (introSegments), with the goals in the colors Screen 2 showed them in.
// Segments with no time are dropped, so a week that is all zeroes is no week.
export function introWeek(
  real: readonly WeekSeg[] | null | undefined,
  goals: readonly string[],
  colors: readonly string[]
): IntroWeek {
  const mine = (real ?? []).filter((s) => Number.isFinite(s.ms) && s.ms > 0);
  if (mine.length > 0) {
    const segs = [...mine].sort((a, b) => b.ms - a.ms);
    return { segs, totalMs: sumMs(segs), sample: false };
  }
  const goalSlot: Record<string, string | undefined> = {
    "goal-0": colors[0],
    "goal-1": colors[1],
  };
  const segs = introSegments(goals).map((s) => ({ ...s, color: goalSlot[s.id] || s.color }));
  return { segs, totalMs: sumMs(segs), sample: true };
}

function sumMs(segs: readonly WeekSeg[]): number {
  return segs.reduce((total, s) => total + s.ms, 0);
}

// The meta beside "This week" (R:115): "{n} CATEGORIES", singular for one,
// which only a real week can have.
export function categoryCountLabel(n: number): string {
  const count = Math.max(0, Math.floor(n));
  return `${count} ${count === 1 ? "CATEGORY" : "CATEGORIES"}`;
}

// CategoryDonut's `max` here: at most five legend rows (R:115). The donut
// itself still draws every segment.
export const INTRO_LEGEND_MAX = 5;

// ---- Beat 3: friend activity (R:122-125) ------------------------------------------

export type ActivityCard = {
  who: string; // the bold first name
  name: string; // the avatar's initials
  username: string; // the avatar's color
  verb: string;
  line: string;
  color: string; // the 3×14 marker
  time: string;
};

// The four cards, exactly as R lists them (names and handles from P:1096-1099).
// Daniel's line names the first habit picked on Screen 3, with R's fallback.
// Daniel's card stays with NUDGES off: D15 hides only Screen 3's nudge pill
// and line, and R:122 has four cards.
export function introActivity(firstHabit: string | null | undefined): ActivityCard[] {
  return [
    {
      who: "Priya",
      name: "Priya Raman",
      username: "priya.r",
      verb: "liked your session",
      line: "Locking in at the library · 2h",
      color: PALETTE[9].fill,
      time: "now",
    },
    {
      who: "Marcus",
      name: "Marcus Lee",
      username: "marcuslee",
      verb: "commented “same spot tomorrow?”",
      line: "Locking in at the library",
      color: PALETTE[9].fill,
      time: "2m",
    },
    {
      who: "Daniel",
      name: "Daniel Kim",
      username: "dkim",
      verb: "nudged you",
      line: introNudgeLine(firstHabit),
      color: PALETTE[4].fill,
      time: "1h",
    },
    {
      who: "Sofia",
      name: "Sofia Alvarez",
      username: "sofia.alv",
      verb: "is clocked in right now",
      line: "Problem set grind",
      color: PALETTE[2].fill,
      time: "live",
    },
  ];
}

// ---- Fitting a short screen ----------------------------------------------------

// The panel is 420px on the handoff's 852pt frame (R:112). On a shorter phone
// (an iPhone SE is 667pt) it gets less, and a beat whose content would be cut
// off at the panel's rounded edge (Beat 2 with five legend rows, or any beat
// on an SE) is scaled down to fit (plan §6, "Small screens"). `natural` is
// where the content ends, not counting the beat's bottom padding, which the
// prototype lets the panel clip (P:254-257). Never up, and never below half
// size, where it would be unreadable anyway and clipping is the lesser evil.
export const MIN_FIT_SCALE = 0.5;

export function fitScale(natural: number, room: number): number {
  if (!(natural > 0) || !(room > 0) || !Number.isFinite(natural) || !Number.isFinite(room)) {
    return 1;
  }
  if (natural <= room) return 1;
  return Math.max(MIN_FIT_SCALE, Math.floor((room / natural) * 1000) / 1000);
}
