import { describe, expect, it, vi } from "vitest";

import {
  BAR_CROSSFADE_MS,
  CHIP_TYPING_MS_PER_CHAR,
  EASING,
  FLIP_MS,
  HANDOFF_EXIT_MS,
  HANDOFF_FADE,
  ITEM_ENTER,
  ITEM_EXIT,
  ITEM_REDUCED,
  KUDOS_LINE_IN,
  MOTION,
  SHEET,
  TOAST,
  TOP_ROW_IN,
  TRAVEL,
  flip,
  flipInvert,
  handoffExitMs,
  itemDelay,
  itemEnter,
  itemExit,
  itemStyle,
  kudosAvatarIn,
  legendRowIn,
  motion,
  navRiseAfter,
  play,
  transition,
  typedPrefix,
  type Effect,
  type Tween,
} from "@/lib/motion";

const E = "cubic-bezier(0.22, 1, 0.36, 1)";

// Under reduced motion "nothing travels" (R:54): no keyframe may carry a
// transform. Opacity changes are all that's left.
function expectOpacityOnly(effect: Effect | null) {
  if (!effect) return;
  for (const frame of effect.keyframes) {
    expect(frame.transform, JSON.stringify(effect)).toBeUndefined();
  }
}

describe("easings (R:42-44)", () => {
  it("are the design's three curves, exactly", () => {
    expect(EASING.E).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(EASING.KB).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(EASING.SPRING).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
  });
});

describe("item stagger (R:45-47)", () => {
  it("enters with opacity 420ms E and transform 560ms E from translateY(18px)", () => {
    expect(ITEM_ENTER).toMatchObject({
      from: "translateY(18px)",
      opacityMs: 420,
      transformMs: 560,
      easing: E,
    });
  });

  it("staggers by 140ms + i × 55ms", () => {
    expect(itemDelay(0)).toBe(140);
    expect(itemDelay(1)).toBe(195);
    expect(itemDelay(4)).toBe(360);
    expect(itemDelay(-2)).toBe(140);
  });

  it("puts the delay on both properties", () => {
    expect(itemEnter(2, false)).toEqual({
      transform: "translateY(18px)",
      tweens: [
        { property: "opacity", duration: 420, easing: E, delay: 250 },
        { property: "transform", duration: 560, easing: E, delay: 250 },
      ],
    });
  });

  it("exits ease-in, opacity 160ms and transform 220ms, up going forward and down going back", () => {
    expect(ITEM_EXIT).toMatchObject({ opacityMs: 160, transformMs: 220, easing: "ease-in" });
    const fwd = itemExit("forward", false);
    expect(fwd.transform).toBe("translateY(-14px)");
    expect(fwd.tweens).toEqual([
      { property: "opacity", duration: 160, easing: "ease-in", delay: 0 },
      { property: "transform", duration: 220, easing: "ease-in", delay: 0 },
    ]);
    expect(itemExit("back", false).transform).toBe("translateY(18px)");
  });

  it("renders as the prototype's item() styles", () => {
    expect(itemStyle("active", 0, false)).toEqual({
      opacity: 1,
      transform: "none",
      transition: `opacity 420ms ${E} 140ms, transform 560ms ${E} 140ms`,
    });
    expect(itemStyle("past", 3, false)).toEqual({
      opacity: 0,
      transform: "translateY(-14px)",
      transition: "opacity 160ms ease-in 0ms, transform 220ms ease-in 0ms",
    });
    expect(itemStyle("ahead", 3, false).transform).toBe("translateY(18px)");
  });
});

describe("items under reduced motion (R:54)", () => {
  it("are opacity 200ms linear, with a 60ms delay on enter", () => {
    expect(ITEM_REDUCED).toEqual({ durationMs: 200, easing: "linear", enterDelayMs: 60 });
    expect(itemEnter(0, true)).toEqual({
      transform: null,
      tweens: [{ property: "opacity", duration: 200, easing: "linear", delay: 60 }],
    });
    expect(itemExit("forward", true)).toEqual({
      transform: null,
      tweens: [{ property: "opacity", duration: 200, easing: "linear", delay: 0 }],
    });
  });

  it("don't stagger: every index enters at 60ms", () => {
    expect(itemEnter(7, true)).toEqual(itemEnter(0, true));
  });

  it("never travel, in any phase", () => {
    for (const phase of ["active", "past", "ahead"] as const) {
      expect(itemStyle(phase, 2, true).transform).toBe("none");
      expect(itemStyle(phase, 2, true).transition).not.toContain("transform");
    }
    expect(itemStyle("active", 2, true).transition).toBe("opacity 200ms linear 60ms");
    expect(itemStyle("past", 2, true).transition).toBe("opacity 200ms linear 0ms");
  });
});

describe("pops (R:48, R:54)", () => {
  it("pop: scale .9 → 1.08 at 65% → 1, 340ms E", () => {
    expect(MOTION.pop.normal).toEqual({
      keyframes: [
        { transform: "scale(0.9)", opacity: 1 },
        { transform: "scale(1.08)", opacity: 1, offset: 0.65 },
        { transform: "scale(1)", opacity: 1 },
      ],
      duration: 340,
      easing: E,
    });
  });

  it("big pop: the same pop from scale .5 and opacity 0", () => {
    expect(MOTION.bigPop.normal.keyframes[0]).toEqual({ transform: "scale(0.5)", opacity: 0 });
    expect(MOTION.bigPop.normal.keyframes.slice(1)).toEqual(MOTION.pop.normal.keyframes.slice(1));
    expect(MOTION.bigPop.normal.duration).toBe(340);
  });

  it("both become opacity .4 → 1, 180ms, under reduced motion", () => {
    const reduced = { keyframes: [{ opacity: 0.4 }, { opacity: 1 }], duration: 180, easing: "linear" };
    expect(MOTION.pop.reduced).toEqual(reduced);
    expect(MOTION.bigPop.reduced).toEqual(reduced);
  });
});

describe("check pop (R:49)", () => {
  it("scales .4 → 1.15 at 70% → 1 from opacity 0, over 300ms", () => {
    expect(MOTION.checkPop.normal).toEqual({
      keyframes: [
        { transform: "scale(0.4)", opacity: 0 },
        { transform: "scale(1.15)", offset: 0.7 },
        { transform: "scale(1)", opacity: 1 },
      ],
      duration: 300,
      easing: E,
    });
  });

  it("only fades in under reduced motion (the prototype's choice)", () => {
    expect(MOTION.checkPop.reduced).toEqual({
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      duration: 300,
      easing: E,
    });
  });
});

describe("shake (R:50)", () => {
  it("is translateX 0, -6, 6, -3, 0 over 400ms ease", () => {
    expect(MOTION.shake.normal).toEqual({
      keyframes: [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      duration: 400,
      easing: "ease",
    });
  });

  it("doesn't happen under reduced motion", () => {
    expect(MOTION.shake.reduced).toBeNull();
    expect(motion("shake", true)).toBeNull();
  });
});

describe("Screen 2's goal rows (R:92, OWNER-FIX-2)", () => {
  it("raises a new row from 30px below at 104%, over 460ms E, or fades it in", () => {
    expect(MOTION.goalRowIn.normal).toEqual({
      keyframes: [
        { opacity: 0, transform: "translateY(30px) scale(1.04)" },
        { opacity: 1, transform: "none" },
      ],
      duration: 460,
      easing: E,
    });
    expect(MOTION.goalRowIn.reduced).toEqual({
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      duration: 200,
      easing: E,
    });
  });

  it("raises the row's hours box 8px a beat behind it, held hidden until its turn", () => {
    expect(MOTION.goalHoursIn.normal).toEqual({
      keyframes: [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      duration: 420,
      easing: E,
      delay: 90,
      fill: "backwards",
    });
  });

  it("has no motion of its own under reduced motion: the row's fade carries it", () => {
    expect(MOTION.goalHoursIn.reduced).toBeNull();
    expect(motion("goalHoursIn", true)).toBeNull();
    expect(motion("goalHoursIn", false)).toBe(MOTION.goalHoursIn.normal);
  });
});

describe("FLIP morphs and their crossfades (R:80, R:54)", () => {
  it("inverts the measured move with origin 0 0", () => {
    const first = { left: 20, top: 410, width: 171.5, height: 300 };
    const last = { left: 20, top: 168, width: 353, height: 52 };
    expect(flipInvert(first, last)).toBe(
      `translate(0px, 242px) scale(${171.5 / 353}, ${300 / 52})`
    );
    expect(flipInvert(first, { ...last, width: 0 })).toBe("none");
  });

  it("morphs over 560ms E", () => {
    const first = { left: 0, top: 0, width: 100, height: 100 };
    const last = { left: 10, top: 20, width: 200, height: 50 };
    expect(FLIP_MS).toBe(560);
    expect(flip(first, last, false)).toEqual({
      keyframes: [{ transform: "translate(-10px, -20px) scale(0.5, 2)" }, { transform: "none" }],
      duration: 560,
      easing: E,
    });
  });

  it("is a 200ms crossfade for the bar under reduced motion", () => {
    const box = { left: 0, top: 0, width: 1, height: 1 };
    expect(BAR_CROSSFADE_MS).toBe(200);
    expect(flip(box, box, true)).toEqual({
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      duration: 200,
      easing: "linear",
    });
  });

  it("fades the bar's contents in over the morph's second half", () => {
    expect(MOTION.barContents.normal).toEqual({
      keyframes: [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }],
      duration: 560,
      easing: "linear",
    });
  });
});

describe("everything else R:54 turns off", () => {
  it("no donut spin", () => {
    expect(MOTION.donutIn.normal).toMatchObject({
      keyframes: [
        { opacity: 0, transform: "rotate(-100deg) scale(0.9)" },
        { opacity: 1, transform: "none" },
      ],
      duration: 780,
      delay: 140,
      fill: "backwards",
    });
    expect(MOTION.donutIn.reduced).toBeNull();
  });

  it("no list stagger: legend rows just appear", () => {
    expect(legendRowIn(0, false)?.delay).toBe(380);
    expect(legendRowIn(2, false)?.delay).toBe(520);
    expect(legendRowIn(2, false)?.duration).toBe(420);
    expect(legendRowIn(1, true)).toBeNull();
  });

  it("goal-chip typing is instant", () => {
    expect(CHIP_TYPING_MS_PER_CHAR).toBe(20);
    expect(typedPrefix("Get stronger", 0, false)).toBe("");
    expect(typedPrefix("Get stronger", 59, false)).toBe("Ge");
    expect(typedPrefix("Get stronger", 10_000, false)).toBe("Get stronger");
    expect(typedPrefix("Get stronger", 0, true)).toBe("Get stronger");
  });

  it("the invite button doesn't pulse", () => {
    expect(MOTION.invitePulse.normal).toEqual({
      keyframes: [
        { transform: "scale(1)" },
        { transform: "scale(1.045)" },
        { transform: "scale(1)" },
      ],
      duration: 1500,
      easing: "ease-in-out",
      delay: 700,
      iterations: Infinity,
    });
    expect(MOTION.invitePulse.reduced).toBeNull();
  });
});

describe("the first-add ring (R:143)", () => {
  it("rings out from the CTA once, 1 → 1.06×1.5 and .5 → 0 over 700ms", () => {
    expect(MOTION.firstAddRing.normal).toEqual({
      keyframes: [
        { opacity: 0.5, transform: "scale(1)" },
        { opacity: 0, transform: "scale(1.06, 1.5)" },
      ],
      duration: 700,
      easing: E,
    });
  });

  it("doesn't play at all under reduced motion, as the prototype doesn't (P:1177)", () => {
    expect(MOTION.firstAddRing.reduced).toBeNull();
    expect(motion("firstAddRing", true)).toBeNull();
  });
});

describe("the handoff to Clock (R:152, plan P7)", () => {
  it("rises the BottomNav 110px over 640ms E after 240ms, or fades it under reduced motion", () => {
    expect(MOTION.navRise.normal).toEqual({
      keyframes: [{ transform: "translateY(110px)" }, { transform: "none" }],
      duration: 640,
      easing: E,
      delay: 240,
      fill: "backwards",
    });
    expect(MOTION.navRise.reduced).toMatchObject({ duration: 200, easing: "linear", delay: 60 });
  });

  it("rises a late nav at once, and one on time after what's left of the 240ms", () => {
    expect(navRiseAfter(false, 0).delay).toBe(240);
    expect(navRiseAfter(false, 100).delay).toBe(140);
    expect(navRiseAfter(false, 240).delay).toBe(0);
    expect(navRiseAfter(false, 900).delay).toBe(0);
    expect(navRiseAfter(false, -50).delay).toBe(240);
    expect(navRiseAfter(false, 900)).toMatchObject({ duration: 640, fill: "backwards" });
    expect(navRiseAfter(true, 900)).toMatchObject({ duration: 200, delay: 0 });
    expect(navRiseAfter(true, 900).keyframes).toEqual(MOTION.navRise.reduced.keyframes);
  });

  it("fades the top row and avatar out, opacity only either way", () => {
    expect(HANDOFF_FADE.normal).toEqual([{ property: "opacity", duration: 240, easing: "linear", delay: 0 }]);
    expect(HANDOFF_FADE.reduced).toEqual([{ property: "opacity", duration: 200, easing: "linear", delay: 0 }]);
  });

  it("waits out the whole exit before navigating, and no longer", () => {
    const longest = (tweens: readonly Tween[]) => Math.max(...tweens.map((t) => t.delay + t.duration));
    // Normal: the fade, the item exit (itemStyle "past") and the CTA's 200ms hide.
    expect(handoffExitMs(false)).toBe(
      Math.max(longest(HANDOFF_FADE.normal), longest(itemExit("forward", false).tweens))
    );
    expect(handoffExitMs(true)).toBe(
      Math.max(longest(HANDOFF_FADE.reduced), longest(itemExit("forward", true).tweens))
    );
    expect(HANDOFF_EXIT_MS).toEqual({ normal: 240, reduced: 200 });
  });
});

describe("springs and entrances (R:44, R:113, R:175)", () => {
  it("springs the kudos avatars in at 800, 970 and 1140ms", () => {
    expect([0, 1, 2].map((i) => kudosAvatarIn(i).normal[1].delay)).toEqual([800, 970, 1140]);
    expect(kudosAvatarIn(0).normal[1]).toMatchObject({ duration: 420, easing: EASING.SPRING });
    expect(kudosAvatarIn(0).from).toBe("scale(0.5)");
    expect(KUDOS_LINE_IN).toEqual({ property: "opacity", duration: 300, easing: "linear", delay: 1350 });
  });

  it("fades the kudos avatars in together under reduced motion, with no stagger (R:54)", () => {
    expect([0, 1, 2].map((i) => kudosAvatarIn(i).reduced)).toEqual(
      Array.from({ length: 3 }, () => [
        { property: "opacity", duration: 200, easing: "linear", delay: 500 },
      ])
    );
  });

  it("drops the toast 10px over 360ms E, visible 2.4s", () => {
    expect(TOAST.from).toBe("translateY(-10px)");
    expect(TOAST.normal).toContainEqual({ property: "transform", duration: 360, easing: E, delay: 0 });
    expect(TOAST.visibleMs).toBe(2400);
  });
});

describe("invariants", () => {
  const allEffects = Object.entries(MOTION).flatMap(([name, pair]) => [
    [`${name}.normal`, pair.normal] as const,
    [`${name}.reduced`, pair.reduced] as const,
  ]);

  it("animates transform and opacity only (R:51)", () => {
    for (const [, effect] of allEffects) {
      for (const frame of effect?.keyframes ?? []) {
        for (const key of Object.keys(frame)) {
          expect(["opacity", "transform", "offset"]).toContain(key);
        }
      }
    }
  });

  it("never travels under reduced motion (R:54)", () => {
    for (const [, pair] of Object.entries(MOTION)) expectOpacityOnly(pair.reduced);
    expectOpacityOnly(flip({ left: 0, top: 0, width: 1, height: 1 }, { left: 9, top: 9, width: 2, height: 2 }, true));
    const travels = (tweens: readonly Tween[]) => tweens.some((t) => t.property === "transform");
    expect(travels(TOP_ROW_IN.reduced)).toBe(false);
    expect(travels(SHEET.in.reduced)).toBe(false);
    expect(travels(SHEET.out.reduced)).toBe(false);
    expect(travels(SHEET.backdrop.reduced)).toBe(false);
    expect(travels(TOAST.reduced)).toBe(false);
    expect(travels(kudosAvatarIn(1).reduced)).toBe(false);
  });

  it("never makes a reduced spec the normal one with its timing turned down", () => {
    // Where both exist, the reduced keyframes themselves must differ, so a
    // reduced spec can't be the normal frames with a shorter duration.
    for (const [name, pair] of Object.entries(MOTION)) {
      if (!pair.normal || !pair.reduced) continue;
      expect(pair.reduced.keyframes, name).not.toEqual(pair.normal.keyframes);
    }
  });

  it("still lifts the CTA clear of the keyboard under reduced motion, just faster", () => {
    expect(TRAVEL.keyboard.normal).toEqual([
      { property: "transform", duration: 440, easing: EASING.KB, delay: 0 },
    ]);
    expect(TRAVEL.keyboard.reduced[0].duration).toBe(260);
  });
});

describe("the welcome's top row and the UW sheet (OWNER-FIX-3)", () => {
  it("fades the progress bar and avatar in on Back's own opacity timing", () => {
    expect(TOP_ROW_IN.normal).toEqual([{ property: "opacity", duration: 260, easing: E, delay: 0 }]);
    expect(TOP_ROW_IN.reduced).toEqual([
      { property: "opacity", duration: 200, easing: "linear", delay: 0 },
    ]);
  });

  it("raises the sheet on KB from past its own height, and lowers it quicker", () => {
    expect(SHEET.from).toBe("translateY(calc(100% + 24px))");
    expect(SHEET.in.normal).toEqual([
      { property: "transform", duration: 440, easing: EASING.KB, delay: 0 },
    ]);
    expect(SHEET.out.normal).toEqual([
      { property: "transform", duration: 320, easing: EASING.KB, delay: 0 },
    ]);
    expect(SHEET.out.normal[0].duration).toBeLessThan(SHEET.in.normal[0].duration);
    expect(SHEET.backdrop.normal).toEqual([
      { property: "opacity", duration: 240, easing: "linear", delay: 0 },
    ]);
  });

  it("only fades the sheet and the dim under reduced motion", () => {
    for (const tweens of [SHEET.in.reduced, SHEET.out.reduced, SHEET.backdrop.reduced]) {
      expect(tweens).toEqual([{ property: "opacity", duration: 200, easing: "linear", delay: 0 }]);
    }
  });

  it("settles a short drag back as bottom-sheet.tsx does", () => {
    expect(transition([SHEET.settle])).toBe(`transform 260ms ${E} 0ms`);
  });
});

describe("helpers", () => {
  it("motion() picks the spec for the current setting", () => {
    expect(motion("pop", false)).toBe(MOTION.pop.normal);
    expect(motion("pop", true)).toBe(MOTION.pop.reduced);
  });

  it("transition() joins tweens, and is none when there are none", () => {
    expect(transition([])).toBe("none");
    expect(transition(TRAVEL.beatSegment.reduced)).toBe("none");
    expect(transition(TRAVEL.keyboard.normal)).toBe(`transform 440ms ${EASING.KB} 0ms`);
  });

  it("play() hands keyframes and timing to element.animate", () => {
    const animate = vi.fn(() => ({ id: "anim" }));
    const el = { animate } as unknown as Element;
    const effect = MOTION.invitePulse.normal;
    expect(play(el, effect)).toEqual({ id: "anim" });
    expect(animate).toHaveBeenCalledWith(effect.keyframes, {
      duration: 1500,
      easing: "ease-in-out",
      delay: 700,
      iterations: Infinity,
    });
  });

  it("play() is a no-op without an element, an effect, or WAAPI", () => {
    expect(play(null, MOTION.pop.normal)).toBeNull();
    expect(play({ animate: vi.fn() } as unknown as Element, null)).toBeNull();
    expect(play({} as Element, MOTION.pop.normal)).toBeNull();
  });
});
