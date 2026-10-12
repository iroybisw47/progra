import { describe, expect, it } from "vitest";

import {
  anim,
  donutArcs,
  easeOutCubic,
  initialStoryState,
  statusBarFor,
  storyStep,
  tapMove,
  DONUT,
} from "@/lib/recap-story-nav";
import { quoteForWeek, RECAP_QUOTES } from "@/lib/recap-quotes";
import { SLIDE_IDS } from "@/lib/recap-story";
import { RECAP_SLIDES } from "@/lib/telemetry/events";
import { statusBarStyle } from "@/lib/status-bar";

describe("storyStep", () => {
  const N = 8;
  it("Loading → Hours under the curtain, by tap, swipe or timer", () => {
    for (const a of ["next", "prev", "intro"] as const) {
      expect(storyStep(initialStoryState(), a, N)).toEqual({ pos: 1, navKey: 1, fromIntro: true });
    }
  });
  it("moves one slide, re-keying every time, curtain only from Loading", () => {
    const s = storyStep({ pos: 3, navKey: 7, fromIntro: true }, "next", N);
    expect(s).toEqual({ pos: 4, navKey: 8, fromIntro: false });
    expect(storyStep(s, "prev", N)).toEqual({ pos: 3, navKey: 9, fromIntro: false });
  });
  it("back from Hours replays Hours, never Loading", () => {
    expect(storyStep({ pos: 1, navKey: 2, fromIntro: true }, "prev", N)).toEqual({
      pos: 1,
      navKey: 3,
      fromIntro: false,
    });
  });
  it("forward on Closing does nothing; the timer only acts on Loading", () => {
    const end = { pos: 7, navKey: 5, fromIntro: false };
    expect(storyStep(end, "next", N)).toBe(end);
    const mid = { pos: 3, navKey: 5, fromIntro: false };
    expect(storyStep(mid, "intro", N)).toBe(mid);
  });
});

describe("tapMove", () => {
  const w = 400;
  it("taps by half", () => {
    expect(tapMove({ dx: 0, dy: 0, x: 120, width: w })).toBe("prev");
    expect(tapMove({ dx: 3, dy: -4, x: 260, width: w })).toBe("next");
  });
  it("swipes need ≥45px and to be more across than down", () => {
    expect(tapMove({ dx: -45, dy: 10, x: 300, width: w })).toBe("next");
    expect(tapMove({ dx: 60, dy: 0, x: 50, width: w })).toBe("prev");
    expect(tapMove({ dx: -50, dy: 50, x: 300, width: w })).toBeNull();
  });
  it("a drag between a tap and a swipe moves nothing", () => {
    expect(tapMove({ dx: 20, dy: 0, x: 300, width: w })).toBeNull();
    expect(tapMove({ dx: 0, dy: 80, x: 300, width: w })).toBeNull();
  });
});

describe("statusBarFor", () => {
  it("light on navy, dark on white, timed to the curtain and the flood", () => {
    expect(statusBarFor("loading", false)).toEqual({ text: "light", delayMs: 0 });
    expect(statusBarFor("hours", true)).toEqual({ text: "dark", delayMs: 700 });
    expect(statusBarFor("hours", false)).toEqual({ text: "dark", delayMs: 0 });
    expect(statusBarFor("closing", false)).toEqual({ text: "light", delayMs: 380 });
  });
  it("maps text colour to the plugin's background-named styles", () => {
    expect(statusBarStyle("light")).toBe("DARK");
    expect(statusBarStyle("dark")).toBe("LIGHT");
    expect(statusBarStyle("default")).toBe("DEFAULT");
  });
});

describe("donutArcs", () => {
  it("draws clockwise in order as one 0.9s stroke", () => {
    const arcs = donutArcs([0.5, 0.25, 0.25]);
    const c = 2 * Math.PI * DONUT.r;
    expect(arcs[0].offset).toBeCloseTo(0);
    expect(arcs[1].offset).toBeCloseTo(-c / 2);
    expect(arcs[2].offset).toBeCloseTo(-c * 0.75);
    expect(arcs[0].delayS).toBeCloseTo(0.25);
    expect(arcs[1].delayS).toBeCloseTo(0.25 + 0.45);
    expect(arcs[2].delayS + arcs[2].durationS).toBeCloseTo(0.25 + 0.9);
    expect(arcs[0].dash).toBe(`${(c / 2).toFixed(2)} ${(c / 2).toFixed(2)}`);
  });
});

describe("motion helpers", () => {
  it("anim writes a both-filled rc-* shorthand", () => {
    expect(anim("rise", 0.5, 0.05)).toBe("rc-rise 0.5s cubic-bezier(.22,1,.36,1) 0.05s both");
    expect(anim("fade", 0.4, 0.1 + 0.2, "ease")).toBe("rc-fade 0.4s ease 0.3s both");
  });
  it("easeOutCubic", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
});

describe("quoteForWeek", () => {
  const list = [
    { text: "a", author: "A" },
    { text: "b", author: "B" },
    { text: "c", author: "C" },
  ];
  it("starts at the week of Oct 5 and plays the list in order, wrapping", () => {
    expect(quoteForWeek("2026-10-05", list).text).toBe("a");
    expect(quoteForWeek("2026-10-12", list).text).toBe("b");
    expect(quoteForWeek("2026-10-26", list).text).toBe("a");
    expect(quoteForWeek("2026-09-28", list).text).toBe("c");
  });
  it("this week's is the owner's Edison", () => {
    expect(quoteForWeek("2026-10-05")).toEqual(RECAP_QUOTES[0]);
    expect(RECAP_QUOTES[0].author).toBe("Thomas Edison");
  });
});

describe("analytics", () => {
  it("logs exactly the story's slides", () => {
    expect([...RECAP_SLIDES]).toEqual([...SLIDE_IDS]);
  });
});
