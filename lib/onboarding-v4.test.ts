import { describe, expect, it } from "vitest";

import { goalSteps, readyGoal, type GoalRow } from "@/lib/onboarding-v3-goals-habits";
import {
  GOAL_COLOR_ORDER,
  HOW_STEPS,
  PRACTICE_TARGET_MS,
  PRACTICE_TOTAL_MS,
  V4_SCREEN,
  V4_STEPS,
  customHabitColor,
  formatClock,
  habitColor,
  habitsCtaLabel,
  initialV4State,
  nextGoalColor,
  practiceElapsed,
  practiceName,
  prefillHabits,
  progressFill,
  stepEyebrow,
  v4Reducer,
  type V4Action,
  type V4State,
} from "@/lib/onboarding-v4";
import { PALETTE } from "@/lib/palette";

const run = (s: V4State, ...actions: V4Action[]) => actions.reduce(v4Reducer, s);
const at = (screen: number, extra: Partial<V4State> = {}): V4State => ({
  ...initialV4State(),
  screen,
  ...extra,
});

describe("screens", () => {
  it("are eight, named with step names analytics accepts", () => {
    expect(V4_STEPS).toEqual([
      "welcome",
      "goal",
      "habit",
      "how",
      "clock",
      "post",
      "friends",
      "notify",
    ]);
    expect(V4_STEPS[V4_SCREEN.notify]).toBe("notify");
  });
});

describe("progress", () => {
  it("is (screen + 1) / 8 with the notifications screen", () => {
    expect(progressFill(V4_SCREEN.welcome, 0, true)).toBe(1 / 8);
    expect(progressFill(V4_SCREEN.post, 0, true)).toBe(6 / 8);
    expect(progressFill(V4_SCREEN.notify, 0, true)).toBe(1);
  });

  it("creeps through How Progra works, landing on its own step", () => {
    const fills = Array.from({ length: HOW_STEPS }, (_, k) => progressFill(V4_SCREEN.how, k, true));
    expect(fills).toEqual([3.25 / 8, 3.5 / 8, 3.75 / 8, 4 / 8]);
  });

  it("counts seven without it, so find your friends ends full", () => {
    expect(progressFill(V4_SCREEN.friends, 0, false)).toBe(1);
    expect(progressFill(V4_SCREEN.habits, 0, false)).toBe(3 / 7);
  });

  it("numbers the eyebrows the way the bar counts", () => {
    expect(stepEyebrow(V4_SCREEN.habits, true)).toBe("Step 3 of 8");
    expect(stepEyebrow(V4_SCREEN.clock, true, true)).toBe("Step 5 of 8 · Practice");
    expect(stepEyebrow(V4_SCREEN.post, false, true)).toBe("Step 6 of 7 · Practice");
  });
});

describe("goal colors", () => {
  it("default to the first unused palette index, in order", () => {
    expect(nextGoalColor([])).toBe(PALETTE[7].fill);
    expect(nextGoalColor([PALETTE[7].fill])).toBe(PALETTE[2].fill);
    expect(nextGoalColor([PALETTE[2].fill.toLowerCase()])).toBe(PALETTE[7].fill);
    expect(GOAL_COLOR_ORDER).toHaveLength(PALETTE.length);
  });

  it("are added with each goal, kept on removal, and set by the sheet", () => {
    let s = run(
      initialV4State(),
      { type: "addGoal", title: "Reading" },
      { type: "addGoal", title: "Studying" },
      { type: "addGoal", title: "Exercising" }
    );
    expect(s.goalColors).toEqual([PALETTE[7].fill, PALETTE[2].fill, PALETTE[5].fill]);
    s = run(s, { type: "removeGoal", index: 0 });
    expect(s.goalColors).toEqual([PALETTE[2].fill, PALETTE[5].fill]);
    s = run(s, { type: "addGoal", title: "Recharging" });
    expect(s.goalColors[2]).toBe(PALETTE[7].fill);
    s = run(s, { type: "setGoalColor", index: 1, color: PALETTE[10].fill });
    expect(s.goalColors).toEqual([PALETTE[2].fill, PALETTE[10].fill, PALETTE[7].fill]);
    expect(run(s, { type: "setGoalColor", index: 1, color: PALETTE[10].fill })).toBe(s);
    expect(run(s, { type: "setGoalColor", index: 9, color: PALETTE[1].fill })).toBe(s);
  });

  it("start in the color they were given", () => {
    const s = run(initialV4State(), { type: "addGoal", title: "Mine", color: "#123456" });
    expect(s.goalColors).toEqual(["#123456"]);
  });

  it("are what a save creates and updates", () => {
    const steps = goalSteps([], ["A", "B"], [5, 3], [null, null], ["#DE5148", "#395AA0"]);
    expect(steps).toEqual([
      { kind: "create", slot: 0, title: "A", color: "#DE5148", hours: 5 },
      { kind: "create", slot: 1, title: "B", color: "#395AA0", hours: 3 },
    ]);
    const rows: GoalRow[] = [
      { id: "w1", title: "A", color: "#DE5148", quotaHours: 5, origin: "wizard", listed: true },
    ];
    expect(goalSteps(rows, ["A"], [5], ["w1"], ["#2E8B50"])).toEqual([
      { kind: "update", id: "w1", patch: { color: "#2E8B50" } },
    ]);
    expect(readyGoal(rows, ["A"], [5], ["w1"], ["#2E8B50"])?.color).toBe("#2E8B50");
  });

  it("recolor an account goal only through its own id", () => {
    const rows: GoalRow[] = [
      { id: "a1", title: "Thesis", color: "#8E3A44", quotaHours: 5, origin: "account", listed: true },
    ];
    expect(goalSteps(rows, ["Thesis"], [5], ["a1"], ["#8E3A44"])).toEqual([]);
    expect(goalSteps(rows, ["Thesis"], [5], ["a1"], ["#6F4E93"])).toEqual([
      { kind: "update", id: "a1", patch: { color: "#6F4E93" } },
    ]);
    // Found by title alone, it keeps its own color.
    expect(goalSteps(rows, ["Thesis"], [5], [null], ["#6F4E93"])).toEqual([]);
  });

  it("leave v3's slot colors alone when none are passed", () => {
    expect(goalSteps([], ["A"], [5], [null])).toEqual([
      { kind: "create", slot: 0, title: "A", color: PALETTE[7].fill, hours: 5 },
    ]);
  });
});

describe("habits", () => {
  it("color presets as designed and typed ones in order", () => {
    expect(habitColor("Journaling", [])).toBe(PALETTE[9].fill);
    expect(habitColor("drinking water", [])).toBe(PALETTE[7].fill);
    expect(habitColor("Floss", ["Read", "Floss"])).toBe(PALETTE[2].fill);
    expect(habitColor("Nope", [])).toBeNull();
    expect(customHabitColor(7)).toBe(PALETTE[7].fill);
  });

  it("add a typed habit selected, and select an existing tile instead of a twin", () => {
    let s = run(initialV4State(), { type: "addCustomHabit", name: "  floss  " });
    expect(s.customHabits).toEqual(["Floss"]);
    expect(s.habits).toEqual(["Floss"]);
    s = run(s, { type: "addCustomHabit", name: "MEDITATION" });
    expect(s.customHabits).toEqual(["Floss"]);
    expect(s.habits).toEqual(["Floss", "Meditation"]);
    expect(run(s, { type: "addCustomHabit", name: "floss" })).toBe(s);
  });

  it("prefill from the account's habits", () => {
    expect(prefillHabits([{ name: "stretching" }, { name: "Read" }, { name: "read" }])).toEqual({
      habits: ["Stretching", "Read"],
      customHabits: ["Read"],
    });
  });

  it("label the CTA by how many are picked", () => {
    expect(habitsCtaLabel(0)).toBe("Save habit");
    expect(habitsCtaLabel(1)).toBe("Save habit");
    expect(habitsCtaLabel(2)).toBe("Save habits");
  });
});

describe("How Progra works", () => {
  it("starts at step 1 going forward and steps through to the practice", () => {
    let s = run(at(V4_SCREEN.habits), { type: "go", to: V4_SCREEN.how });
    expect(s.howStep).toBe(0);
    s = run(s, { type: "nextHow" }, { type: "nextHow" }, { type: "nextHow" });
    expect(s.howStep).toBe(3);
    s = run(s, { type: "nextHow" });
    expect(s.screen).toBe(V4_SCREEN.clock);
  });

  it("lands on step 4 coming back from the practice clock-in", () => {
    const s = run(at(V4_SCREEN.clock), { type: "back" });
    expect(s.screen).toBe(V4_SCREEN.how);
    expect(s.howStep).toBe(HOW_STEPS - 1);
  });

  it("only moves while it's in front", () => {
    const s = at(V4_SCREEN.goal);
    expect(run(s, { type: "nextHow" })).toBe(s);
    const first = at(V4_SCREEN.how);
    expect(run(first, { type: "prevHow" })).toBe(first);
  });

  it("formats the timer as h:mm:ss", () => {
    expect(formatClock(0)).toBe("0:00:00");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("the practice clock-in", () => {
  it("runs in real time, then eases out to 25:00", () => {
    expect(practiceElapsed(0)).toBe(0);
    expect(practiceElapsed(1000)).toBe(1000);
    expect(practiceElapsed(PRACTICE_TOTAL_MS)).toBe(PRACTICE_TARGET_MS);
    expect(practiceElapsed(PRACTICE_TOTAL_MS + 5000)).toBe(PRACTICE_TARGET_MS);
    // Ease-out: past halfway in value by halfway in time.
    const half = practiceElapsed(1500 + 900);
    expect(half).toBeGreaterThan(PRACTICE_TARGET_MS / 2);
  });

  it("is called Practice unless named", () => {
    expect(practiceName("")).toBe("Practice");
    expect(practiceName("  Essay ")).toBe("Essay");
  });
});

describe("the UW question after the post", () => {
  it("rises over the post and only there", () => {
    expect(run(at(V4_SCREEN.welcome), { type: "openUwSheet" }).uwSheet).toBe(false);
    expect(run(at(V4_SCREEN.post), { type: "openUwSheet" }).uwSheet).toBe(true);
  });

  it("opens the UW page on Yes, and Back from it is the post", () => {
    let s = run(
      at(V4_SCREEN.post),
      { type: "openUwSheet" },
      { type: "pickUw", choice: "yes" },
      { type: "openUw" }
    );
    expect(s).toMatchObject({ uwPage: true, uwSheet: false, uwListed: true, screen: V4_SCREEN.post });
    s = run(s, { type: "back" });
    expect(s).toMatchObject({ uwPage: false, screen: V4_SCREEN.post });
  });

  it("finds the page again from find your friends while the answer is Yes", () => {
    const yes = at(V4_SCREEN.friends, { uw: "yes", uwPhase: "open" });
    expect(run(yes, { type: "back" })).toMatchObject({ screen: V4_SCREEN.post, uwPage: true });
    const no = at(V4_SCREEN.friends, { uw: "no", uwPhase: "selecting" });
    expect(run(no, { type: "back" })).toMatchObject({
      screen: V4_SCREEN.post,
      uwPage: false,
      uw: null,
      uwPhase: "choose",
    });
  });

  it("goes straight to the page from the post's Continue once Yes is answered", () => {
    const s = run(at(V4_SCREEN.post, { uw: "yes", uwPhase: "open" }), { type: "openUwSheet" });
    expect(s).toMatchObject({ uwPage: true, uwSheet: false });
  });

  it("asks again on Change, over the post", () => {
    const s = run(at(V4_SCREEN.post, { uw: "yes", uwPhase: "open", uwPage: true }), {
      type: "changeUw",
    });
    expect(s).toMatchObject({ uw: null, uwPhase: "choose", uwPage: false, uwSheet: true });
  });

  it("goes down with any move", () => {
    const s = run(at(V4_SCREEN.post, { uwSheet: true }), { type: "go", to: V4_SCREEN.friends });
    expect(s.uwSheet).toBe(false);
  });
});

describe("Back", () => {
  it("has nowhere to go from the welcome", () => {
    const s = initialV4State();
    expect(run(s, { type: "back" })).toBe(s);
  });
});
