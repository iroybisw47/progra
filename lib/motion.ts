// Onboarding v3's motion as data (.claude/plans/onboarding-v3.md P2 and §6).
// The sources are the handoff README's "Motion tokens" (R:41-51) and "Reduced
// motion" (R:53-54), plus the per-element timings R gives elsewhere. Where R
// is silent, the prototype's own numbers (P) fill the gap.
//
// It's data rather than CSS because the one-shots (pops, the shake, the
// goal-row insert, the donut entry) run through WAAPI's element.animate(),
// and WAAPI can't reference a CSS @keyframes rule by name. The frames have to
// exist in JS anyway. Keeping every number here beside its reduced-motion
// twin lets lib/motion.test.ts pin the whole spec without a device.
//
// Two rules hold throughout, and the tests check both:
//   - Transform and opacity only (R:51). Nothing here animates layout.
//   - Reduced motion is a SEPARATE spec for each effect, never the normal one
//     with its duration turned down. Under it nothing travels (R:54), so every
//     reduced spec is opacity only, or null where R says the effect doesn't
//     happen at all (the shake, donut spin, list stagger and invite pulse).
//     The only transforms left under reduced motion are functional ones in
//     TRAVEL: the CTA still has to clear the keyboard, and the progress bar
//     still has to fill.
//
// The `motion` package is used only by the recap story
// (app/recap/[weekStart]/recap-story.tsx). It stays out of the onboarding
// chunk because WAAPI covers everything here natively (plan §6, which wrongly
// says nothing imports it).
//
// Everything that imports it ships dark behind ONBOARDING_V3 or FRIENDS_V3,
// except the BottomNav, which is live but plays MOTION.navRise only after
// v3's Screen 6 has asked it to (lib/nav-rise.ts).

// ---- Easings (R:42-44) -------------------------------------------------------

export const EASING = {
  // E: the default ease-out, for nearly everything.
  E: "cubic-bezier(0.22, 1, 0.36, 1)",
  // KB: anything that moves with the keyboard, and sheets.
  KB: "cubic-bezier(0.32, 0.72, 0, 1)",
  // SPRING: badges and kudos avatars. It overshoots, so use it on transform
  // only (opacity would clamp at 1).
  SPRING: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

const { E, KB, SPRING } = EASING;

// ---- Shapes ------------------------------------------------------------------

// One WAAPI keyframe, narrowed to the two properties v3 may animate.
export type Frame = { opacity?: number; transform?: string; offset?: number };

// A WAAPI one-shot: element.animate(keyframes, timing). See play().
export type Effect = {
  keyframes: Frame[];
  duration: number;
  easing: string;
  delay?: number;
  iterations?: number;
  // "backwards" holds the first frame through `delay`, so a staggered element
  // doesn't flash at full opacity before its turn.
  fill?: FillMode;
};

// One property's CSS transition, for motion driven by a style change rather
// than WAAPI: items, travelling elements and anything that reverses mid-way.
export type Tween = {
  property: "opacity" | "transform";
  duration: number;
  easing: string;
  delay: number;
};

const opacityTween = (duration: number, easing: string, delay = 0): Tween => ({
  property: "opacity",
  duration,
  easing,
  delay,
});
const transformTween = (duration: number, easing: string, delay = 0): Tween => ({
  property: "transform",
  duration,
  easing,
  delay,
});

// Tweens → a CSS `transition` value. No tweens means "none", so the change is
// instant.
export function transition(tweens: readonly Tween[]): string {
  if (tweens.length === 0) return "none";
  return tweens
    .map((t) => `${t.property} ${t.duration}ms ${t.easing} ${t.delay}ms`)
    .join(", ");
}

// Plays an effect on an element. Null-safe on both sides, so a missing ref or
// an effect that reduced motion turned off is a no-op and the caller needs no
// branch. Returns the Animation so an infinite one (the invite pulse) can be
// cancelled.
export function play(
  el: Element | null | undefined,
  effect: Effect | null
): Animation | null {
  if (!el || !effect || typeof el.animate !== "function") return null;
  const { keyframes, ...timing } = effect;
  return el.animate(keyframes, timing);
}

// ---- Items: every screen's staggered elements (R:45-47) ----------------------

// Driven by CSS transitions on a state change. An item is "active" on its
// screen, "past" once the user has gone forward from that screen, and "ahead"
// before they reach it (or after they go back from it). An ahead item rests
// where it enters from, so going back and going forward share one resting
// pose (P:1317-1321).
export const ITEM_ENTER = {
  from: "translateY(18px)",
  opacityMs: 420,
  transformMs: 560,
  easing: E,
  delayMs: 140,
  staggerMs: 55,
} as const;

export const ITEM_EXIT = {
  forward: "translateY(-14px)",
  back: "translateY(18px)",
  opacityMs: 160,
  transformMs: 220,
  easing: "ease-in",
} as const;

// Reduced (R:54): opacity 200ms linear, a flat 60ms delay on enter. There's
// no per-index stagger, because "no list stagger" holds for items too.
export const ITEM_REDUCED = {
  durationMs: 200,
  easing: "linear",
  enterDelayMs: 60,
} as const;

// 140ms + i × 55ms (R:46).
export function itemDelay(i: number): number {
  return ITEM_ENTER.delayMs + Math.max(0, Math.floor(i)) * ITEM_ENTER.staggerMs;
}

// `transform` is where the item travels FROM on enter, or TO on exit. It is
// null when the item doesn't travel at all (reduced motion).
export type ItemMotion = { transform: string | null; tweens: Tween[] };

export function itemEnter(i: number, reduced: boolean): ItemMotion {
  if (reduced) {
    return {
      transform: null,
      tweens: [
        opacityTween(ITEM_REDUCED.durationMs, ITEM_REDUCED.easing, ITEM_REDUCED.enterDelayMs),
      ],
    };
  }
  const delay = itemDelay(i);
  return {
    transform: ITEM_ENTER.from,
    tweens: [
      opacityTween(ITEM_ENTER.opacityMs, ITEM_ENTER.easing, delay),
      transformTween(ITEM_ENTER.transformMs, ITEM_ENTER.easing, delay),
    ],
  };
}

export function itemExit(direction: "forward" | "back", reduced: boolean): ItemMotion {
  if (reduced) {
    return {
      transform: null,
      tweens: [opacityTween(ITEM_REDUCED.durationMs, ITEM_REDUCED.easing)],
    };
  }
  return {
    transform: direction === "forward" ? ITEM_EXIT.forward : ITEM_EXIT.back,
    tweens: [
      opacityTween(ITEM_EXIT.opacityMs, ITEM_EXIT.easing),
      transformTween(ITEM_EXIT.transformMs, ITEM_EXIT.easing),
    ],
  };
}

export type ItemPhase = "active" | "past" | "ahead";
export type ItemStyle = { opacity: number; transform: string; transition: string };

// The inline style for item `i` in a phase, the prototype's item() (P:1317).
// The transition describes how the item gets INTO this phase. Becoming active
// runs the staggered enter, and becoming past or ahead runs the exit toward
// that side.
export function itemStyle(phase: ItemPhase, i: number, reduced: boolean): ItemStyle {
  if (phase === "active") {
    return { opacity: 1, transform: "none", transition: transition(itemEnter(i, reduced).tweens) };
  }
  const exit = itemExit(phase === "past" ? "forward" : "back", reduced);
  return { opacity: 0, transform: exit.transform ?? "none", transition: transition(exit.tweens) };
}

// ---- One-shots (WAAPI) -------------------------------------------------------

export type MotionPair = { normal: Effect | null; reduced: Effect | null };

// R:54: "Pops become opacity .4→1 180ms". One spec covers both pop sizes.
const POP_REDUCED: Effect = {
  keyframes: [{ opacity: 0.4 }, { opacity: 1 }],
  duration: 180,
  easing: "linear",
};

// The two-frame opacity fade that reduced motion swaps in for things that
// appear. The prototype uses its default easing (E) for these, not linear.
const fadeIn = (duration: number, easing: string = E): Effect => ({
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  duration,
  easing,
});

export const MOTION = {
  // A chip added or selected (R:48).
  pop: {
    normal: {
      keyframes: [
        { transform: "scale(0.9)", opacity: 1 },
        { transform: "scale(1.08)", opacity: 1, offset: 0.65 },
        { transform: "scale(1)", opacity: 1 },
      ],
      duration: 340,
      easing: E,
    },
    reduced: POP_REDUCED,
  },
  // A new element (R:48): the pop, from scale .5 and opacity 0.
  bigPop: {
    normal: {
      keyframes: [
        { transform: "scale(0.5)", opacity: 0 },
        { transform: "scale(1.08)", opacity: 1, offset: 0.65 },
        { transform: "scale(1)", opacity: 1 },
      ],
      duration: 340,
      easing: E,
    },
    reduced: POP_REDUCED,
  },
  // A check mark arriving (R:49): the handle's "available" tick and a
  // selected tile's check. The plan leaves its reduced form open. The
  // prototype fades it in from nothing over the same 300ms (P:676, P:694), so
  // a check that wasn't there doesn't flash in at 40%.
  checkPop: {
    normal: {
      keyframes: [
        { transform: "scale(0.4)", opacity: 0 },
        { transform: "scale(1.15)", offset: 0.7 },
        { transform: "scale(1)", opacity: 1 },
      ],
      duration: 300,
      easing: E,
    },
    reduced: fadeIn(300),
  },
  // Invalid input (R:50). Reduced: no shake at all (R:54).
  shake: {
    normal: {
      keyframes: [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      duration: 400,
      easing: "ease",
    },
    reduced: null,
  },

  // ---- The UW sheet (R:77-80, OWNER-FIX-3)
  // A UW tile's selected bounce (R:77).
  tileBounce: {
    normal: {
      keyframes: [
        { transform: "scale(0.97)" },
        { transform: "scale(1.015)", offset: 0.6 },
        { transform: "scale(1)" },
      ],
      duration: 340,
      easing: E,
    },
    reduced: null,
  },
  // The Yes bar's contents fade in over the second half of its FLIP (R:80).
  // Under reduced motion the bar's crossfade (flip()) carries its contents.
  barContents: {
    normal: {
      keyframes: [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }],
      duration: 560,
      easing: "linear",
    },
    reduced: null,
  },

  // ---- Screen 2 (R:92)
  // A goal row arriving in the list.
  goalRowIn: {
    normal: {
      keyframes: [
        { opacity: 0, transform: "translateY(30px) scale(1.04)" },
        { opacity: 1, transform: "none" },
      ],
      duration: 460,
      easing: E,
    },
    reduced: fadeIn(200),
  },
  // The goal's weekly-hours box under its title (OWNER-FIX-2), rising in a
  // beat after the row it belongs to, as the alternatives under a taken
  // handle follow its shake. R has no box, so the numbers are the wizard's
  // own: suggestionChipIn's 8px rise, the legend rows' 420ms. Reduced: none
  // of its own, since the row's fade carries it in.
  goalHoursIn: {
    normal: {
      keyframes: [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      duration: 420,
      easing: E,
      delay: 90,
      fill: "backwards",
    },
    reduced: null,
  },

  // ---- Screen 3 (R:100)
  // Deselecting a habit chip. Selecting it is `pop` on the chip plus `bigPop`
  // on its check.
  chipRelease: {
    normal: {
      keyframes: [{ transform: "scale(0.94)" }, { transform: "scale(1)" }],
      duration: 220,
      easing: E,
    },
    reduced: null,
  },

  // ---- Screen 4 (R:121, R:127)
  // The donut rotates in. Reduced: "no donut spin" (R:54). Query the svg from a
  // wrapper ref (P:1011-1017), because CategoryDonut doesn't forward one.
  donutIn: {
    normal: {
      keyframes: [
        { opacity: 0, transform: "rotate(-100deg) scale(0.9)" },
        { opacity: 1, transform: "none" },
      ],
      duration: 780,
      easing: E,
      delay: 140,
      fill: "backwards",
    },
    reduced: null,
  },
  // "Back" from beat 1 bumps the panel, since there is nowhere to go.
  panelBump: {
    normal: {
      keyframes: [
        { transform: "translateX(0)" },
        { transform: "translateX(9px)" },
        { transform: "translateX(0)" },
      ],
      duration: 320,
      easing: E,
    },
    reduced: null,
  },

  // ---- Screen 5 (R:133, R:143)
  // The invite button's breathing pulse. It's infinite, so keep the Animation
  // play() returns and cancel it when the button leaves the screen. It never
  // runs under reduced motion (R:54).
  invitePulse: {
    normal: {
      keyframes: [
        { transform: "scale(1)" },
        { transform: "scale(1.045)" },
        { transform: "scale(1)" },
      ],
      duration: 1500,
      easing: "ease-in-out",
      delay: 700,
      iterations: Infinity,
    },
    reduced: null,
  },
  // The 2px ring around the CTA on the first person added (R:143), as the
  // CTA turns from "Skip for now" into "Continue · 1 added". Nothing under
  // reduced motion, as in the prototype (P:1177 plays it only when !rm): the
  // CTA's own change of label and color says it.
  firstAddRing: {
    normal: {
      keyframes: [
        { opacity: 0.5, transform: "scale(1)" },
        { opacity: 0, transform: "scale(1.06, 1.5)" },
      ],
      duration: 700,
      easing: E,
    },
    reduced: null,
  },

  // ---- Handoff to Clock (R:152, plan P7)
  // R:152's two ring pulses on the Clock-in CTA aren't here: since
  // OWNER-FIX-1 the handoff lands on the normal Clock tab, which is left as
  // it is, so the BottomNav's rise is the handoff's one effect outside the
  // wizard.
  //
  // The BottomNav rising into place as the Clock tab arrives. Reduced: it
  // fades in on the item rule's reduced timing (200ms linear after 60ms).
  navRise: {
    normal: {
      keyframes: [{ transform: "translateY(110px)" }, { transform: "none" }],
      duration: 640,
      easing: E,
      delay: 240,
      fill: "backwards",
    },
    reduced: {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      duration: ITEM_REDUCED.durationMs,
      easing: ITEM_REDUCED.easing,
      delay: ITEM_REDUCED.enterDelayMs,
      fill: "backwards",
    },
  },
} satisfies Record<string, MotionPair>;

export type MotionName = keyof typeof MOTION;

// The effect to play right now: `play(el, motion("pop", reduced))`.
export function motion(name: MotionName, reduced: boolean): Effect | null {
  const pair: MotionPair = MOTION[name];
  return reduced ? pair.reduced : pair.normal;
}

// R:152 times the handoff from the "Start session" tap: the nav rises 240ms
// in. The Clock tab only arrives once the wizard's exit is over, though, and
// on a first run the nav arrives later still (it mounts once the stamp lands,
// app/clock/finish-onboarding.tsx), so it's played from where it is on that
// timeline rather than from its own mount.

// The nav's rise for a nav that appears `sinceTapMs` after the tap
// (lib/nav-rise.ts): whatever is left of the delay, or none, so a late nav
// rises at once rather than waiting the full delay again.
export function navRiseAfter(reduced: boolean, sinceTapMs: number): Effect & { delay: number } {
  const effect = reduced ? MOTION.navRise.reduced : MOTION.navRise.normal;
  return { ...effect, delay: Math.max(0, effect.delay - Math.max(0, sinceTapMs)) };
}

// ---- Parametric one-shots ----------------------------------------------------

export type Box = { left: number; top: number; width: number; height: number };

// An element's box on screen, for a FLIP's first and last (the UW sheet's Yes
// tile, measured as its hold ends, and the UW page's bar).
export function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

// FLIP: the transform that puts an element measured at `last` back over where
// it was at `first`. Animate from this to "none" and it appears to morph. It
// assumes `transform-origin: 0 0`, as the prototype's bar has (P:91). A
// zero-size `last` (not laid out yet) can't be inverted, so this gives "none".
export function flipInvert(first: Box, last: Box): string {
  if (last.width <= 0 || last.height <= 0) return "none";
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

// The UW Yes tile morphing into the bar (R:80): 560ms E. Reduced: no morph.
// The bar crossfades in place over 200ms (R:54's "bar/avatar just crossfade
// 200-240ms").
export const FLIP_MS = 560;
export const BAR_CROSSFADE_MS = 200;

export function flip(first: Box, last: Box, reduced: boolean): Effect {
  if (reduced) return fadeIn(BAR_CROSSFADE_MS, "linear");
  return {
    keyframes: [{ transform: flipInvert(first, last) }, { transform: "none" }],
    duration: FLIP_MS,
    easing: E,
  };
}

// Beat 2's legend rows after the donut (R:121): 420ms each, from 380ms, +70ms
// apart. Reduced: none, since there's no list stagger.
export function legendRowIn(i: number, reduced: boolean): Effect | null {
  if (reduced) return null;
  return {
    keyframes: [
      { opacity: 0, transform: "translateY(6px)" },
      { opacity: 1, transform: "none" },
    ],
    duration: 420,
    easing: E,
    delay: 380 + Math.max(0, Math.floor(i)) * 70,
    fill: "backwards",
  };
}

// ---- Travel and entrances (CSS transitions) ---------------------------------

// The wizard leaving for the Clock tab (R:152, plan P7). Its items exit on
// the item rule (itemStyle, "past") while the top row, its avatar with it,
// fades out, opacity only either way: under reduced motion it's the item
// rule's reduced fade. The CTA stays where it is, as the prototype keeps its one CTA
// through the handoff (P:1228), until the Clock tab replaces the wizard.
export const HANDOFF_FADE = {
  normal: [opacityTween(240, "linear")],
  reduced: [opacityTween(ITEM_REDUCED.durationMs, ITEM_REDUCED.easing)],
} satisfies { normal: Tween[]; reduced: Tween[] };

// How long Screen 6 lets that exit play before it navigates: the longest of
// the pieces above (the 240ms fade beats the item exit's 220ms transform).
// Navigating sooner would cut it off, since a fully prefetched Clock page
// replaces the wizard in a frame.
export const HANDOFF_EXIT_MS = { normal: 240, reduced: ITEM_REDUCED.durationMs } as const;

export function handoffExitMs(reduced: boolean): number {
  return reduced ? HANDOFF_EXIT_MS.reduced : HANDOFF_EXIT_MS.normal;
}

// Elements that move between measured positions as a style changes, and what
// they do under reduced motion. The CTA still clears the keyboard, which is
// layout rather than decoration, just sooner (P:1413). Beat segments snap.
//
// Since OWNER-FIX-3 the avatar no longer travels: Screen 1 is the welcome,
// whose photo is its own picker, and the top row's 28px avatar fades in with
// the row from Screen 2 (TOP_ROW_IN).
export const TRAVEL = {
  // The CTA and the goal examples riding above the keyboard (R:38, R:94),
  // and the welcome screen and the UW sheet making room for it.
  keyboard: {
    normal: [transformTween(440, KB)],
    reduced: [transformTween(260, KB)],
  },
  // The progress bar's fill, scaleX((screen + 1) / 6) (R:36). Under reduced
  // motion it's a fill updating, not something travelling, so it stays a
  // quick linear change.
  progress: {
    normal: [transformTween(760, E)],
    reduced: [transformTween(200, "linear")],
  },
  // Screen 4's beat segments filling (R:107).
  beatSegment: {
    normal: [transformTween(420, E)],
    reduced: [],
  },
} satisfies Record<string, { normal: Tween[]; reduced: Tween[] }>;

// Something that appears by transitioning in from an offset. Under reduced
// motion it only fades.
export type Entrance = { from: string; normal: Tween[]; reduced: Tween[] };

// The top row's progress bar and 28px avatar (OWNER-FIX-3): hidden on the
// welcome screen, which never had them, and fading in as Screen 2 arrives, on
// Back's own fade (wizard-chrome.tsx). Opacity only: nothing travels in from
// a slot any more.
export const TOP_ROW_IN = {
  normal: [opacityTween(260, E)],
  reduced: [opacityTween(200, "linear")],
} satisfies { normal: Tween[]; reduced: Tween[] };

// ---- The UW sheet (OWNER-FIX-3) ----------------------------------------------

// The bottom sheet the welcome's Continue raises with the UW question (the
// look of components/v2/bottom-sheet.tsx). It rises on KB, the easing for
// sheets and anything that moves with the keyboard, from just past its own
// height below the screen (the extra 24px clears its shadow), and goes back
// down a little quicker. The welcome screen dims behind it. Reduced: nothing
// travels (R:54), so the sheet and the dim only fade.
export const SHEET = {
  from: "translateY(calc(100% + 24px))",
  in: {
    normal: [transformTween(440, KB)],
    reduced: [opacityTween(200, "linear")],
  },
  out: {
    normal: [transformTween(320, KB)],
    reduced: [opacityTween(200, "linear")],
  },
  backdrop: {
    normal: [opacityTween(240, "linear")],
    reduced: [opacityTween(200, "linear")],
  },
  // Let go short of a dismissal, it settles back as bottom-sheet.tsx's does.
  settle: transformTween(260, E),
} as const;

// The navy pill toast (R:175): a 10px drop and fade, then hidden after
// `visibleMs`. R allows 2.4-2.6s; 2.4 is the invite toast's (P:1165).
export const TOAST = {
  from: "translateY(-10px)",
  normal: [opacityTween(200, "linear"), transformTween(360, E)],
  reduced: [opacityTween(200, "linear")],
  visibleMs: 2400,
} as const satisfies Entrance & { visibleMs: number };

// Beat 1's three kudos avatars (R:113): they spring in at 800, 970 and
// 1140ms. Reduced: they fade in together at 500ms, after the post. The
// prototype staggers them 150ms apart (P:1083), but the plan's P5 and R:54
// say no stagger under reduced motion, and they win.
const KUDOS_REDUCED_DELAY_MS = 500;

export function kudosAvatarIn(i: number): Entrance {
  const k = Math.max(0, Math.floor(i));
  return {
    from: "scale(0.5)",
    normal: [opacityTween(200, "linear", 800 + k * 170), transformTween(420, SPRING, 800 + k * 170)],
    reduced: [opacityTween(200, "linear", KUDOS_REDUCED_DELAY_MS)],
  };
}

// "Zack, Priya and Leo gave you kudos" fades in at 1350ms either way (R:113).
export const KUDOS_LINE_IN: Tween = opacityTween(300, "linear", 1350);

// ---- Typing a goal example in (R:94) ----------------------------------------

// Tapping an example chip types it into the field at 20ms a character. Under
// reduced motion it lands whole (R:54).
export const CHIP_TYPING_MS_PER_CHAR = 20;

// What the field shows `elapsedMs` after the tap. It's pure, so the screen
// drives it from one interval or rAF and stops once it returns the full text.
export function typedPrefix(text: string, elapsedMs: number, reduced: boolean): string {
  if (reduced) return text;
  const chars = Array.from(text);
  const n = Math.floor(Math.max(0, elapsedMs) / CHIP_TYPING_MS_PER_CHAR);
  return chars.slice(0, n).join("");
}
