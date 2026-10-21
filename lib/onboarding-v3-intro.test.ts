import { describe, expect, it } from "vitest";

import { INTRO_BEATS, INTRO_CAPTIONS, goalColor } from "@/lib/onboarding-v3";
import {
  KUDOS_FRIENDS,
  KUDOS_LINE,
  MIN_FIT_SCALE,
  SWIPE_MIN_PX,
  TAP_SLOP_PX,
  beatMove,
  beatPhase,
  beatSegmentFill,
  categoryCountLabel,
  fitScale,
  introActivity,
  introAnnouncement,
  introCaption,
  introCaptionText,
  introCtaLabel,
  introGoal,
  introSummary,
  introWeek,
  type WeekSeg,
} from "@/lib/onboarding-v3-intro";
import { PALETTE } from "@/lib/palette";

const MIN = 60_000;

describe("beatMove: taps (R:126)", () => {
  const tap = (x: number, width = 353) => beatMove({ dx: 0, dy: 0, x, width });

  it("goes on from the right two thirds and back from the left third", () => {
    expect(tap(340)).toBe("next");
    expect(tap(200)).toBe("next");
    expect(tap(118)).toBe("next"); // just past the third
    expect(tap(117)).toBe("prev");
    expect(tap(10)).toBe("prev");
  });

  it("splits at a third of whatever width the panel has", () => {
    expect(beatMove({ dx: 0, dy: 0, x: 120, width: 390 })).toBe("prev");
    expect(beatMove({ dx: 0, dy: 0, x: 130, width: 390 })).toBe("next");
  });

  it("forgives a finger that wanders a little", () => {
    expect(beatMove({ dx: 6, dy: -6, x: 300, width: 353 })).toBe("next");
    expect(beatMove({ dx: -TAP_SLOP_PX, dy: 0, x: 40, width: 353 })).toBe("prev");
  });
});

describe("beatMove: swipes (R:126, P:1046)", () => {
  it("pages on a horizontal swipe past 36px, left for next", () => {
    expect(beatMove({ dx: -(SWIPE_MIN_PX + 1), dy: 0, x: 100, width: 353 })).toBe("next");
    expect(beatMove({ dx: SWIPE_MIN_PX + 1, dy: 0, x: 300, width: 353 })).toBe("prev");
  });

  it("goes by the swipe's direction, not by where it ended", () => {
    // Ends in the left third, but swiped left: next.
    expect(beatMove({ dx: -120, dy: 4, x: 30, width: 353 })).toBe("next");
    // Ends on the right, but swiped right: back.
    expect(beatMove({ dx: 120, dy: -4, x: 330, width: 353 })).toBe("prev");
  });

  it("needs to be more across than down", () => {
    expect(beatMove({ dx: -50, dy: 49, x: 200, width: 353 })).toBe("next");
    expect(beatMove({ dx: -50, dy: 50, x: 200, width: 353 })).toBeNull();
    expect(beatMove({ dx: 10, dy: 80, x: 300, width: 353 })).toBeNull();
  });

  it("does nothing for a drag that's neither a tap nor a swipe", () => {
    // The prototype would call this a tap on the right and go FORWARD.
    expect(beatMove({ dx: 30, dy: 0, x: 300, width: 353 })).toBeNull();
    expect(beatMove({ dx: -SWIPE_MIN_PX, dy: 0, x: 300, width: 353 })).toBeNull();
  });

  it("ignores a press it can't measure", () => {
    expect(beatMove({ dx: Number.NaN, dy: 0, x: 10, width: 353 })).toBeNull();
    expect(beatMove({ dx: 0, dy: 0, x: 10, width: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe("beat poses (P:1068, P:1079)", () => {
  it("shows only the current beat while Screen 4 is in front", () => {
    expect([0, 1, 2].map((k) => beatPhase(k, 1, "active"))).toEqual(["past", "active", "ahead"]);
    expect([0, 1, 2].map((k) => beatPhase(k, 0, "active"))).toEqual(["active", "ahead", "ahead"]);
    expect([0, 1, 2].map((k) => beatPhase(k, 2, "active"))).toEqual(["past", "past", "active"]);
  });

  it("shows no beat while another screen is in front", () => {
    for (const screen of ["past", "ahead"] as const) {
      for (let beat = 0; beat < INTRO_BEATS; beat++) {
        for (let k = 0; k < INTRO_BEATS; k++) {
          expect(beatPhase(k, beat, screen)).not.toBe("active");
        }
      }
    }
  });

  it("fills the progress up to and including the current beat (R:107)", () => {
    const fills = (beat: number, screen: "active" | "past" | "ahead") =>
      [0, 1, 2].map((k) => beatSegmentFill(k, beat, screen));
    expect(fills(0, "active")).toEqual([1, 0, 0]);
    expect(fills(1, "active")).toEqual([1, 1, 0]);
    expect(fills(2, "active")).toEqual([1, 1, 1]);
    expect(fills(0, "past")).toEqual([1, 1, 1]);
    expect(fills(2, "ahead")).toEqual([0, 0, 0]);
  });

  it("labels the CTA Next, then Continue on the last beat", () => {
    expect(introCtaLabel(0)).toBe("Next");
    expect(introCtaLabel(1)).toBe("Next");
    expect(introCtaLabel(INTRO_BEATS - 1)).toBe("Continue");
  });
});

describe("introGoal", () => {
  // The ink and wash are display forms (lib/colors.ts), so they follow the
  // theme; the color stays the hex Screen 2 holds.
  it("is goal 1 in the color Screen 2 drew it, with its ink and a 14% wash (R:113)", () => {
    const blue = goalColor(0);
    expect(introGoal(["  Get stronger ", "Learn Spanish"], [blue.fill, "#E07042"])).toEqual({
      title: "Get stronger",
      color: blue.fill,
      ink: "var(--palette-7-ink)",
      wash: "color-mix(in srgb, var(--palette-7) 14%, transparent)",
    });
  });

  it("keeps a replayer's own goal color", () => {
    const pink = PALETTE[10];
    expect(introGoal(["Thesis"], [pink.fill])).toMatchObject({
      color: pink.fill,
      ink: "var(--palette-10-ink)",
    });
  });

  it("falls back to the prototype's example in palette 7 with no goal", () => {
    expect(introGoal([], [])).toMatchObject({
      title: "Launch my side project",
      color: goalColor(0).fill,
      ink: "var(--palette-7-ink)",
    });
    expect(introGoal(["   "], []).title).toBe("Launch my side project");
  });
});

describe("introCaption (R:108-111)", () => {
  it("wraps goal 1 in beat 1's caption", () => {
    const c = introCaption(0, "Get stronger");
    expect(c).toEqual({
      before: "When you clock in on ",
      goal: { head: "Get", tail: " stronger" },
      after: ", your friends see it in their feed.",
    });
    expect(introCaptionText(c)).toBe(INTRO_CAPTIONS.feed.join("Get stronger"));
  });

  it("splits off the goal's first word, which keeps the square if a long goal has to wrap", () => {
    expect(introCaption(0, "Train for a half marathon").goal).toEqual({
      head: "Train",
      tail: " for a half marathon",
    });
    expect(introCaption(0, "Spanish").goal).toEqual({ head: "Spanish", tail: "" });
    expect(introCaption(0, "  Learn   Spanish ").goal).toEqual({ head: "Learn", tail: " Spanish" });
  });

  it("has the other two captions, with no goal", () => {
    expect(introCaption(1, "Get stronger")).toEqual({
      before: "Your hours add up.",
      goal: null,
      after: "",
    });
    expect(introCaptionText(introCaption(2, "Get stronger"))).toBe(
      "And friends keep each other going."
    );
  });

  it("announces the beat's position before its caption", () => {
    expect(introAnnouncement(0, "Get stronger")).toBe(
      `1 of ${INTRO_BEATS}. When you clock in on Get stronger, your friends see it in their feed.`
    );
    expect(introAnnouncement(1, "Get stronger")).toBe(`2 of ${INTRO_BEATS}. Your hours add up.`);
    expect(introAnnouncement(2, "Get stronger")).toBe(
      `3 of ${INTRO_BEATS}. And friends keep each other going.`
    );
  });
});

describe("introSummary", () => {
  it("marks the made-up beats as examples", () => {
    for (const beat of [0, 2]) {
      for (const sample of [true, false]) expect(introSummary(beat, sample)).toMatch(/^Example: /);
    }
    expect(introSummary(1, true)).toMatch(/^Example: /);
  });

  it("doesn't call a replayer's real week an example", () => {
    expect(introSummary(1, false)).not.toMatch(/example/i);
  });
});

describe("introWeek (D15, R:114-121)", () => {
  const real: WeekSeg[] = [
    { id: "c1", name: "Reading", color: "#D6A728", ms: 45 * MIN },
    { id: "goal:g1", name: "Goal: Thesis", color: "#395AA0", ms: 200 * MIN },
    { id: null, name: "Uncategorized", color: "var(--chart-5)", ms: 30 * MIN },
  ];

  it("draws the person's own week when they've tracked time, largest first", () => {
    const week = introWeek(real, ["Thesis"], [goalColor(0).fill]);
    expect(week.sample).toBe(false);
    expect(week.segs.map((s) => s.name)).toEqual(["Goal: Thesis", "Reading", "Uncategorized"]);
    expect(week.totalMs).toBe(275 * MIN);
    // The caller's array is left as it was.
    expect(real[0].name).toBe("Reading");
  });

  it("drops empty categories, and an empty week is no week", () => {
    const week = introWeek([...real, { id: "c2", name: "Gym", color: "#77B7C6", ms: 0 }], [], []);
    expect(week.segs).toHaveLength(3);
    const zeroes = introWeek([{ id: "c2", name: "Gym", color: "#77B7C6", ms: 0 }], ["Thesis"], []);
    expect(zeroes.sample).toBe(true);
  });

  it("draws the sample for a first run, with goals 1 and 2 slotted in", () => {
    const week = introWeek(undefined, ["Get stronger", "Learn Spanish"], []);
    expect(week.sample).toBe(true);
    expect(week.segs.map((s) => [s.name, s.color, s.ms / MIN])).toEqual([
      ["Schoolwork", "#6F4E93", 560],
      ["Get stronger", "#395AA0", 390],
      ["Gym", "#77B7C6", 255],
      ["Learn Spanish", "#E07042", 180],
      ["Reading", "#D6A728", 130],
    ]);
    expect(week.totalMs).toBe(1515 * MIN);
    expect(introWeek(null, [], []).sample).toBe(true);
  });

  it("colors the sample's goals as Screen 2 showed them", () => {
    const pink = PALETTE[10].fill;
    const green = PALETTE[5].fill;
    const week = introWeek([], ["Thesis", "Run"], [pink, green]);
    expect(week.segs.find((s) => s.name === "Thesis")?.color).toBe(pink);
    expect(week.segs.find((s) => s.name === "Run")?.color).toBe(green);
    expect(week.segs.find((s) => s.name === "Schoolwork")?.color).toBe("#6F4E93");
  });

  it("counts the categories for the meta, singular for one", () => {
    expect(categoryCountLabel(5)).toBe("5 CATEGORIES");
    expect(categoryCountLabel(4)).toBe("4 CATEGORIES");
    expect(categoryCountLabel(1)).toBe("1 CATEGORY");
    expect(categoryCountLabel(0)).toBe("0 CATEGORIES");
  });
});

describe("Beat 1's kudos (R:113)", () => {
  it("names the three friends whose avatars spring in", () => {
    expect(KUDOS_FRIENDS.map((f) => f.username)).toEqual(["zack", "priya.r", "leo.m"]);
    expect(KUDOS_LINE).toBe("Zack, Priya and Leo gave you kudos");
  });
});

describe("introActivity (R:122-125)", () => {
  it("is R's four cards, exactly", () => {
    expect(introActivity("Stretch").map((c) => [c.who, c.verb, c.line, c.color, c.time])).toEqual([
      ["Priya", "liked your session", "Locking in at the library · 2h", "#6F4E93", "now"],
      ["Marcus", "commented “same spot tomorrow?”", "Locking in at the library", "#6F4E93", "2m"],
      ["Daniel", "nudged you", "“Stretch” is still open today", "#7CBE6D", "1h"],
      ["Sofia", "is clocked in right now", "Problem set grind", "#E07042", "live"],
    ]);
  });

  it("falls back on Daniel's line with no habit picked", () => {
    const daniel = introActivity(null).find((c) => c.who === "Daniel");
    expect(daniel?.line).toBe("Still time to clock in today");
  });

  it("gives every card its own avatar", () => {
    const cards = introActivity(null);
    expect(new Set(cards.map((c) => c.username)).size).toBe(cards.length);
  });
});

describe("fitScale (plan §6, small screens)", () => {
  it("leaves a beat that fits alone, and never scales up", () => {
    expect(fitScale(380, 420)).toBe(1);
    expect(fitScale(420, 420)).toBe(1);
    expect(fitScale(100, 420)).toBe(1);
  });

  it("scales a beat taller than the panel down to fit it", () => {
    const s = fitScale(457, 420);
    expect(s).toBeLessThan(1);
    expect(457 * s).toBeLessThanOrEqual(420);
    expect(457 * s).toBeGreaterThan(419);
  });

  it("stops at half size", () => {
    expect(fitScale(1000, 100)).toBe(MIN_FIT_SCALE);
  });

  it("does nothing with no measurement yet", () => {
    expect(fitScale(0, 420)).toBe(1);
    expect(fitScale(400, 0)).toBe(1);
    expect(fitScale(Number.NaN, 420)).toBe(1);
  });
});
