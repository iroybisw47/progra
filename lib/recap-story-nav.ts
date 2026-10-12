import type { SlideId } from "@/lib/recap-story";

// How the weekly review story MOVES (RECAP_V2): the position reducer, what a
// pointer gesture means, when the status bar flips, and the donut's arcs. Pure
// and client-safe — the controller (components/recap-story/recap-story-v2.tsx)
// is wiring around these. Numbers are the handoff prototype's
// (design_handoff_weekly_recap/Weekly Recap.dc.html).

// The loading screen hands off once the logo's clock has filled — the only
// thing in the story that advances on its own.
export const INTRO_MS = 2050;
// Horizontal travel that makes a swipe; under TAP_SLOP_PX of travel is a tap.
// In between (or vertical) is a drag — a scroll inside a long slide — and
// moves nothing.
export const SWIPE_MIN_PX = 45;
export const TAP_SLOP_PX = 10;

// navKey re-keys the slide on EVERY move, so its choreography replays on
// entry; fromIntro is true only on the step off Loading (the curtain) — onto
// Hours, or onto the first review's Welcome.
export type StoryState = { pos: number; navKey: number; fromIntro: boolean };
export type StoryAction = "next" | "prev" | "intro";

export function initialStoryState(pos = 0): StoryState {
  return { pos, navKey: 0, fromIntro: false };
}

export function storyStep(state: StoryState, action: StoryAction, slideCount: number): StoryState {
  const last = slideCount - 1;
  const go = (pos: number, fromIntro = false): StoryState => ({
    pos: Math.max(0, Math.min(last, pos)),
    navKey: state.navKey + 1,
    fromIntro,
  });
  // On Loading, any move (or the timer) goes on to the first slide under the
  // curtain.
  if (state.pos === 0) return go(1, true);
  if (action === "intro") return state;
  if (action === "next") return state.pos >= last ? state : go(state.pos + 1);
  // Back from the first slide stays there (replaying it) — never back to
  // Loading.
  return go(Math.max(1, state.pos - 1));
}

export type Move = "next" | "prev" | null;

// A finished pointer gesture, from its travel and where it landed: a swipe
// left/right, a tap on the right/left half, or nothing (a drag).
export function tapMove(g: { dx: number; dy: number; x: number; width: number }): Move {
  const ax = Math.abs(g.dx);
  const ay = Math.abs(g.dy);
  if (ax >= SWIPE_MIN_PX && ax > ay) return g.dx < 0 ? "next" : "prev";
  if (Math.max(ax, ay) > TAP_SLOP_PX) return null;
  return g.x < g.width / 2 ? "prev" : "next";
}

// Light status-bar text on the navy slides, dark on white. Timed to the
// motion: dark ≈700ms after the curtain starts lifting, light ≈380ms into the
// closing flood.
export function statusBarFor(
  slide: SlideId,
  fromIntro: boolean
): { text: "light" | "dark"; delayMs: number } {
  if (slide === "loading") return { text: "light", delayMs: 0 };
  if (slide === "closing") return { text: "light", delayMs: 380 };
  return { text: "dark", delayMs: fromIntro ? 700 : 0 };
}

// The "Where it went" ring: one dashed circle per category, drawn clockwise in
// order so the whole ring reads as ONE continuous 0.9s stroke.
export const DONUT = { size: 180, r: 80, stroke: 20, drawS: 0.9, startS: 0.25 } as const;

export function donutArcs(shares: number[], r: number = DONUT.r) {
  const c = 2 * Math.PI * r;
  let acc = 0;
  return shares.map((share) => {
    const len = share * c;
    const arc = {
      c,
      dash: `${len.toFixed(2)} ${(c - len).toFixed(2)}`,
      offset: -acc,
      delayS: DONUT.startS + (acc / c) * DONUT.drawS,
      durationS: share * DONUT.drawS,
    };
    acc += len;
    return arc;
  });
}

// The handoff's easings.
export const EASE = {
  out: "cubic-bezier(.22,1,.36,1)",
  inOut: "cubic-bezier(.65,0,.35,1)",
  curtain: "cubic-bezier(.76,0,.24,1)",
} as const;

// One CSS `animation` shorthand for an rc-* keyframe (app/globals.css).
export function anim(name: string, durationS: number, delayS = 0, easing: string = EASE.out): string {
  return `rc-${name} ${durationS}s ${easing} ${+delayS.toFixed(3)}s both`;
}

// Count-up easing: ease-out cubic.
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}
