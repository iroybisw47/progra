import { describe, expect, it } from "vitest";

import {
  PRACTICE_SECS,
  earlySeconds,
  endedStatus,
  formatHoursMinutes,
  formatPracticeClock,
  heroSample,
  liveLabel,
  pickMeta,
  practiceCta,
  practiceGoals,
  practiceStopped,
  practicePose,
  simSeconds,
} from "@/lib/onboarding-v3-practice";

describe("the practice timer", () => {
  it("runs the first second at true speed", () => {
    expect(simSeconds(0, false)).toEqual({ sim: 0, done: false });
    expect(simSeconds(500, false)).toEqual({ sim: 0.5, done: false });
  });

  it("then fast-forwards to 25:00 over 3.4s on a cubic in-out, and is done there", () => {
    expect(simSeconds(1000, false)).toEqual({ sim: 1, done: false });
    // Halfway through the fast part is halfway through the run.
    expect(simSeconds(1000 + 1700, false).sim).toBeCloseTo(1 + 1499 / 2, 6);
    // Eased: a quarter of the way in is well short of a quarter of the run.
    expect(simSeconds(1000 + 850, false).sim).toBeLessThan(PRACTICE_SECS / 4);
    expect(simSeconds(4400, false)).toEqual({ sim: PRACTICE_SECS, done: true });
    expect(simSeconds(9000, false)).toEqual({ sim: PRACTICE_SECS, done: true });
  });

  it("never runs backwards", () => {
    let last = -1;
    for (let ms = 0; ms <= 4600; ms += 37) {
      const { sim } = simSeconds(ms, false);
      expect(sim).toBeGreaterThanOrEqual(last);
      last = sim;
    }
  });

  it("steps in five minutes every 500ms under reduced motion, done at 2.8s", () => {
    expect([0, 499, 500, 1000, 2500, 2799].map((ms) => simSeconds(ms, true).sim)).toEqual([
      0, 0, 300, 600, 1500, 1500,
    ]);
    expect(simSeconds(2799, true).done).toBe(false);
    expect(simSeconds(2800, true)).toEqual({ sim: PRACTICE_SECS, done: true });
  });

  it("treats a bad clock as the start", () => {
    expect(simSeconds(Number.NaN, false)).toEqual({ sim: 0, done: false });
    expect(simSeconds(-20, true)).toEqual({ sim: 0, done: false });
  });

  it("freezes a clock-out on a whole second, never 0:00:00", () => {
    expect(earlySeconds(0.2)).toBe(1);
    expect(earlySeconds(612.9)).toBe(612);
    expect(earlySeconds(Number.NaN)).toBe(1);
    expect(earlySeconds(99999)).toBe(PRACTICE_SECS);
  });

  it("reads H:MM:SS", () => {
    expect(formatPracticeClock(0)).toBe("0:00:00");
    expect(formatPracticeClock(1)).toBe("0:00:01");
    expect(formatPracticeClock(1500)).toBe("0:25:00");
    expect(formatPracticeClock(3725.9)).toBe("1:02:05");
    expect(formatPracticeClock(-4)).toBe("0:00:00");
  });
});

describe("the practice run's words", () => {
  it("labels the eyebrow by how the run stopped", () => {
    expect(liveLabel("running", null)).toBe("Clocked in");
    expect(liveLabel("ended", "auto")).toBe("Timer done");
    expect(liveLabel("ended", "early")).toBe("Clocked out");
    expect(liveLabel("post", "early")).toBe("Clocked out");
  });

  it("counts the run stopped from the ended phase on", () => {
    expect(["intro", "ready", "running"].map((d) => practiceStopped(d as "intro"))).toEqual([
      false,
      false,
      false,
    ]);
    expect(["ended", "post", "posted"].map((d) => practiceStopped(d as "ended"))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("says how it ended", () => {
    expect(endedStatus("auto", PRACTICE_SECS)).toBe("25 minutes done. Your timer clocked you out.");
    expect(endedStatus("early", 612)).toBe("Clocked out at 10m.");
    expect(endedStatus("early", 3)).toBe("Clocked out at 1m.");
  });

  it("asks to pick a goal only when there's more than one", () => {
    expect(pickMeta(1)).toBeUndefined();
    expect(pickMeta(2)).toBe("PICK ONE");
  });
});

describe("the practice CTA (the handoff's CTA map)", () => {
  it("names each phase's move", () => {
    expect(practiceCta("intro", false)).toEqual({ label: "Start the example", variant: "primary" });
    expect(practiceCta("ready", false)).toEqual({ label: "Clock in", variant: "primary" });
    expect(practiceCta("running", false)).toEqual({ label: "Clock out", variant: "secondary" });
    expect(practiceCta("ended", false)).toEqual({ label: "Continue", variant: "primary" });
    expect(practiceCta("posted", true)).toEqual({ label: "Continue", variant: "primary" });
  });

  it("opens the picker until there's a photo, then posts", () => {
    expect(practiceCta("post", false).label).toBe("Add a photo");
    expect(practiceCta("post", true).label).toBe("Post");
  });
});

describe("practicePose", () => {
  it("is active on the phases an element shows in", () => {
    expect(practicePose("active", "running", ["running", "ended"])).toBe("active");
    expect(practicePose("active", "ended", ["running", "ended"])).toBe("active");
  });

  it("is past once the run has moved beyond them, ahead before", () => {
    expect(practicePose("active", "post", ["running", "ended"])).toBe("past");
    expect(practicePose("active", "ready", ["running", "ended"])).toBe("ahead");
    expect(practicePose("active", "intro", ["intro"])).toBe("active");
    expect(practicePose("active", "ready", ["intro"])).toBe("past");
  });

  it("follows the screen once it's not in front", () => {
    expect(practicePose("past", "intro", ["posted"])).toBe("past");
    expect(practicePose("ahead", "posted", ["posted"])).toBe("ahead");
  });
});

describe("practiceGoals", () => {
  it("lists Screen 2's goals in the colors it drew them in", () => {
    expect(practiceGoals(["Get stronger", "Learn Spanish"], ["#111111", "#222222"])).toEqual([
      { title: "Get stronger", color: "#111111" },
      { title: "Learn Spanish", color: "#222222" },
    ]);
  });

  it("falls back to the goal palette, and to an example when there's no goal", () => {
    expect(practiceGoals(["Get stronger", "Learn Spanish"], [])).toEqual([
      { title: "Get stronger", color: "#395AA0" },
      { title: "Learn Spanish", color: "#E07042" },
    ]);
    expect(practiceGoals([], [])).toEqual([{ title: "Launch my side project", color: "#395AA0" }]);
  });
});

describe("the hero preview", () => {
  it("draws the illustrative week", () => {
    const hero = heroSample([]);
    expect(hero.segments).toEqual([
      { color: "#395AA0", value: 390 },
      { color: "#E07042", value: 180 },
      { color: "#6F4E93", value: 130 },
    ]);
    expect(hero.total).toBe("11h 40m");
    expect(hero.goals).toEqual([
      { id: "hero-goal", title: "Study", color: "#395AA0", quotaHours: 10, actualMs: 6.5 * 3_600_000 },
    ]);
    expect(hero.today).toBe("2026-10-16");
    expect(hero.weekStart).toBe("2026-10-12");
  });

  it("uses the first two habits picked, or two stand-ins", () => {
    expect(heroSample([]).habits.map((h) => [h.name, h.color])).toEqual([
      ["Drink water", "#7CBE6D"],
      ["Stretch", "#77B7C6"],
    ]);
    expect(heroSample(["Read", "Meditate", "Journal"]).habits.map((h) => h.name)).toEqual([
      "Read",
      "Meditate",
    ]);
    expect(heroSample(["Read"]).habits.map((h) => h.name)).toEqual(["Read"]);
  });

  it("checks habit 1 off Mon, Tue, Wed, Fri and habit 2 Mon, Wed, Thu, Fri", () => {
    const hero = heroSample([]);
    const days = (i: number) =>
      hero.completions.filter((c) => c.habitId === hero.habits[i].id).map((c) => c.completedOn);
    expect(days(0)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16"]);
    expect(days(1)).toEqual(["2026-10-12", "2026-10-14", "2026-10-15", "2026-10-16"]);
    expect(new Set(hero.completions.map((c) => c.id)).size).toBe(hero.completions.length);
  });

  it("formats hours and minutes", () => {
    expect(formatHoursMinutes(700)).toBe("11h 40m");
    expect(formatHoursMinutes(65)).toBe("1h 05m");
    expect(formatHoursMinutes(45)).toBe("45m");
  });
});
