import { describe, expect, it } from "vitest";

import { APP_STORE_URL } from "@/lib/app-store";
import { inviteBody } from "@/lib/invite-share";
import { DEFAULT_GOAL_QUOTA_HOURS, V3_STEPS } from "@/lib/onboarding";
import {
  GOAL_EXAMPLES,
  GOAL_HOURS_MAX,
  GOAL_HOURS_MIN,
  GOAL_TITLE_MAX,
  HABIT_NAME_MAX,
  MAX_GOALS,
  SCREEN,
  SCREEN_COUNT,
  notifyReasons,
  notifyScreenShown,
  progressFor,
  stepOverNotify,
  V3_HABITS,
  clampGoalHours,
  formatGoalHours,
  formatGoalTitle,
  formatHabitName,
  goalColor,
  goalExamplesFor,
  goalHint,
  goalHoursOrDefault,
  goalKeys,
  goalPlaceholder,
  habitNudgeText,
  hoursFieldText,
  hoursInput,
  hoursText,
  initialWizardState,
  FIND_FRIENDS_COPY,
  friendsCta,
  inviteText,
  readyNote,
  resolveHoursDraft,
  stepGoalHours,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from "@/lib/onboarding-v3";
import { MAX_UW_INTERESTS, MAX_UW_MAJORS } from "@/lib/uw";

describe("screens", () => {
  it("are V3_STEPS, so each screen reports under the step analytics expects", () => {
    expect(SCREEN_COUNT).toBe(7);
    expect(V3_STEPS[SCREEN.identity]).toBe("welcome");
    expect(V3_STEPS[SCREEN.goal]).toBe("goal");
    expect(V3_STEPS[SCREEN.habits]).toBe("habit");
    expect(V3_STEPS[SCREEN.intro]).toBe("how");
    expect(V3_STEPS[SCREEN.friends]).toBe("friends");
    expect(V3_STEPS[SCREEN.notify]).toBe("notify");
    expect(V3_STEPS[SCREEN.ready]).toBe("clock");
  });
});

describe("the notifications screen", () => {
  const ALL = { clockReminders: true, habitReminders: true, socialPush: true, nudges: true, recapPush: true };
  const NONE = { clockReminders: false, habitReminders: false, socialPush: false, nudges: false, recapPush: false };

  it("is shown only while iOS can still ask, and only with something to send", () => {
    const reasons = notifyReasons(ALL);
    expect(notifyScreenShown("prompt", reasons)).toBe(true);
    for (const state of ["granted", "denied", "unavailable", null]) {
      expect(notifyScreenShown(state, reasons)).toBe(false);
    }
    expect(notifyScreenShown("prompt", [])).toBe(false);
  });

  it("lists only what this build sends", () => {
    expect(notifyReasons(NONE)).toEqual([]);
    expect(notifyReasons(ALL)).toHaveLength(6);
    expect(notifyReasons({ ...NONE, habitReminders: true })).toEqual([
      "A daily reminder for your habits",
    ]);
    // A nudge only buzzes with social pushes on.
    expect(notifyReasons({ ...NONE, nudges: true })).toEqual([]);
    expect(notifyReasons({ ...NONE, socialPush: true, nudges: true })).toHaveLength(3);
  });

  it("is stepped over in the direction of travel when it isn't part of the run", () => {
    expect(stepOverNotify(SCREEN.notify, SCREEN.friends, false)).toBe(SCREEN.ready);
    expect(stepOverNotify(SCREEN.notify, SCREEN.ready, false)).toBe(SCREEN.friends);
    expect(stepOverNotify(SCREEN.notify, SCREEN.friends, true)).toBe(SCREEN.notify);
    expect(stepOverNotify(SCREEN.ready, SCREEN.friends, false)).toBe(SCREEN.ready);
    expect(stepOverNotify(SCREEN.goal, SCREEN.identity, false)).toBe(SCREEN.goal);
  });

  it("counts the progress bar as the person sees the run", () => {
    expect(progressFor(SCREEN.friends, true)).toEqual({ at: SCREEN.friends, of: 7 });
    expect(progressFor(SCREEN.ready, true)).toEqual({ at: SCREEN.ready, of: 7 });
    expect(progressFor(SCREEN.friends, false)).toEqual({ at: SCREEN.friends, of: 6 });
    // The ready screen is the last of six, so the bar is full.
    expect(progressFor(SCREEN.ready, false)).toEqual({ at: 5, of: 6 });
  });
});

describe("goals (R:92-96)", () => {
  it("colors goals palette 7, 2, 5 in order", () => {
    expect(goalColor(0).fill).toBe("#395AA0");
    expect(goalColor(1).fill).toBe("#E07042");
    expect(goalColor(2).fill).toBe("#2E8B50");
    expect(goalColor(0).ink).toBe("#33518F");
    expect(goalColor(3).fill).toBe("#2E8B50");
    expect(goalColor(-1).fill).toBe("#395AA0");
  });

  it("changes the placeholder as goals are added", () => {
    expect(goalPlaceholder(0)).toBe("Type your own");
    expect(goalPlaceholder(1)).toBe("Add another (optional)");
    expect(goalPlaceholder(2)).toBe("Add another (optional)");
    expect(goalPlaceholder(3)).toBe("Three is plenty");
  });

  it("hints only while typing, and only promises another goal when one would fit", () => {
    expect(goalHint(0, "")).toBe("");
    expect(goalHint(0, "   ")).toBe("");
    expect(goalHint(0, "Get")).toBe("Return adds it, then add another or continue");
    expect(goalHint(1, "Get")).toBe("Return adds it, then add another or continue");
    expect(goalHint(2, "Get")).toBe("Return adds it");
    expect(goalHint(3, "Get")).toBe("");
  });

  it("has the design's example chips, exactly (R:94)", () => {
    expect(GOAL_EXAMPLES).toEqual([
      "Launch my side project",
      "Get stronger",
      "Ace organic chem",
      "Train for a half marathon",
      "Learn Spanish",
      "Finish my thesis",
    ]);
  });

  it("hides examples already added, and all of them at the cap", () => {
    expect(goalExamplesFor(["get stronger "])).not.toContain("Get stronger");
    expect(goalExamplesFor(["get stronger "])).toHaveLength(GOAL_EXAMPLES.length - 1);
    expect(goalExamplesFor(["a", "b", "c"])).toEqual([]);
  });

  it("formats a typed title as the reducer lists it", () => {
    expect(formatGoalTitle("  Get   stronger ")).toBe("Get stronger");
    expect(formatGoalTitle("   ")).toBe("");
    expect(formatGoalTitle("g".repeat(80))).toHaveLength(GOAL_TITLE_MAX);
    expect(formatGoalTitle("g".repeat(59) + "🇺🇸")).toBe("g".repeat(59));
    for (const raw of ["  learn\tspanish ", "x".repeat(70), "Run 🏃🏽"]) {
      expect(wizardReducer(initialWizardState(), { type: "addGoal", title: raw }).goals).toEqual([
        formatGoalTitle(raw),
      ]);
    }
  });

  it("keys each goal by its title and the copies above it, so a removal keeps the others' keys", () => {
    expect(goalKeys([])).toEqual([]);
    expect(goalKeys(["A", "B"])).toEqual(["0:A", "0:B"]);
    expect(goalKeys(["Run", "Run", "X"])).toEqual(["0:Run", "1:Run", "0:X"]);
    expect(goalKeys(["A", "B", "C"]).slice(1)).toEqual(goalKeys(["B", "C"]));
    // Two copies: taking out either leaves one "0:Run", and "1:Run" goes.
    expect(goalKeys(["Run", "X"])).toEqual(["0:Run", "0:X"]);
  });
});

describe("goal hours (OWNER-FIX-2)", () => {
  it("are whole hours from 1 to 40, starting at 5", () => {
    expect(GOAL_HOURS_MIN).toBe(1);
    expect(GOAL_HOURS_MAX).toBe(40);
    expect(DEFAULT_GOAL_QUOTA_HOURS).toBe(5);
  });

  it("start a box at a stored quota as it is, and at 5 when it isn't one", () => {
    expect(goalHoursOrDefault(8)).toBe(8);
    // Never rounded or clamped: a replay that leaves the box alone writes nothing.
    expect(goalHoursOrDefault(2.5)).toBe(2.5);
    expect(goalHoursOrDefault(60)).toBe(60);
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, undefined, null]) {
      expect(goalHoursOrDefault(bad)).toBe(5);
    }
    expect(goalHoursOrDefault("8" as never)).toBe(5);
  });

  it("set whole hours within 1-40, and nothing for something that isn't a number", () => {
    expect(clampGoalHours(12)).toBe(12);
    expect(clampGoalHours(2.4)).toBe(2);
    expect(clampGoalHours(2.5)).toBe(3);
    expect(clampGoalHours(0)).toBe(1);
    expect(clampGoalHours(-7)).toBe(1);
    expect(clampGoalHours(41)).toBe(40);
    expect(clampGoalHours(1000)).toBe(40);
    expect(clampGoalHours(Number.POSITIVE_INFINITY)).toBe(40);
    expect(clampGoalHours(Number.NaN)).toBeNull();
  });

  it("type as digits only, at most three, full-width ones included", () => {
    expect(hoursInput("12")).toBe("12");
    expect(hoursInput("１２")).toBe("12");
    expect(hoursInput("10h")).toBe("10");
    expect(hoursInput(" 7 ")).toBe("7");
    expect(hoursInput("abc")).toBe("");
    expect(hoursInput("")).toBe("");
    // A third digit isn't swallowed, so 100 can snap to 40 rather than read 10.
    expect(hoursInput("100")).toBe("100");
    expect(hoursInput("１２３")).toBe("123");
    expect(hoursInput("1234")).toBe("123");
  });

  it("type whole hours only: nothing from a decimal point or comma on (D2)", () => {
    expect(hoursInput("2.5")).toBe("2");
    expect(hoursInput("1,5")).toBe("1");
    expect(hoursInput("12.75")).toBe("12");
    expect(hoursInput(".5")).toBe("");
    expect(hoursInput(",5")).toBe("");
    // Full-width points, as NFKC reads them.
    expect(hoursInput("２．５")).toBe("2");
    expect(hoursInput("３，５")).toBe("3");
    expect(hoursInput("4.")).toBe("4");
  });

  it("keep a point in the field's text as typed, so the digits after it can't run on (D2)", () => {
    // The field cleans its text on every keystroke, as this does.
    const typed = (keys: string) => [...keys].reduce((text, key) => hoursFieldText(text + key), "");
    expect(typed("2.5")).toBe("2.5");
    expect(resolveHoursDraft(typed("2.5"), 5)).toEqual({ hours: 2, snapped: false });
    expect(typed("1,5")).toBe("1,5");
    expect(resolveHoursDraft(typed("1,5"), 5)).toEqual({ hours: 1, snapped: false });
    // A point first keeps the hours as they were.
    expect(typed(".5")).toBe(".5");
    expect(resolveHoursDraft(typed(".5"), 5)).toEqual({ hours: 5, snapped: false });
    // One point at most, three characters, digits only besides.
    expect(hoursFieldText("2.5.")).toBe("2.5");
    expect(hoursFieldText("2..5")).toBe("2.5");
    expect(hoursFieldText("12.5")).toBe("12.");
    expect(hoursFieldText("10h")).toBe("10");
    expect(hoursFieldText("100")).toBe("100");
    expect(hoursFieldText("1000")).toBe("100");
    expect(hoursFieldText("１２")).toBe("12");
    expect(hoursFieldText("２．５")).toBe("2.5");
    expect(hoursFieldText("abc")).toBe("");
    // Typed key by key, 100 still gets to snap.
    expect(resolveHoursDraft(typed("100"), 5)).toEqual({ hours: 40, snapped: true });
  });

  it("commit a typed draft, keeping the hours when nothing was typed", () => {
    expect(resolveHoursDraft("", 5)).toEqual({ hours: 5, snapped: false });
    expect(resolveHoursDraft("", 2.5)).toEqual({ hours: 2.5, snapped: false });
    expect(resolveHoursDraft("", 60)).toEqual({ hours: 60, snapped: false });
    expect(resolveHoursDraft("7", 5)).toEqual({ hours: 7, snapped: false });
    expect(resolveHoursDraft("07", 5)).toEqual({ hours: 7, snapped: false });
    expect(resolveHoursDraft("5", 5)).toEqual({ hours: 5, snapped: false });
    expect(resolveHoursDraft("1", 5)).toEqual({ hours: 1, snapped: false });
    expect(resolveHoursDraft("40", 5)).toEqual({ hours: 40, snapped: false });
  });

  it("keep the hours exactly when the field is left as focus filled it (U3)", () => {
    // Focus puts the hours in the field as formatGoalHours writes them.
    expect(resolveHoursDraft(formatGoalHours(2.5), 2.5)).toEqual({ hours: 2.5, snapped: false });
    expect(resolveHoursDraft(formatGoalHours(60), 60)).toEqual({ hours: 60, snapped: false });
    expect(resolveHoursDraft(formatGoalHours(8), 8)).toEqual({ hours: 8, snapped: false });
    // Typed over, they're the whole hours typed.
    expect(resolveHoursDraft("2", 2.5)).toEqual({ hours: 2, snapped: false });
    expect(resolveHoursDraft("2.5", 5)).toEqual({ hours: 2, snapped: false });
    expect(resolveHoursDraft(".5", 5)).toEqual({ hours: 5, snapped: false });
  });

  it("snap a typed draft out of range to the nearest limit, and say so", () => {
    expect(resolveHoursDraft("0", 5)).toEqual({ hours: 1, snapped: true });
    expect(resolveHoursDraft("00", 5)).toEqual({ hours: 1, snapped: true });
    expect(resolveHoursDraft("41", 5)).toEqual({ hours: 40, snapped: true });
    expect(resolveHoursDraft("55", 5)).toEqual({ hours: 40, snapped: true });
    expect(resolveHoursDraft("99", 40)).toEqual({ hours: 40, snapped: true });
    // Three digits reach here and snap (U6).
    expect(resolveHoursDraft("100", 5)).toEqual({ hours: 40, snapped: true });
    expect(resolveHoursDraft("1000", 5)).toEqual({ hours: 40, snapped: true });
    // Read as its whole hours, whatever else is in it: an IME's full-width
    // text included, which the field keeps raw until the composition ends.
    expect(resolveHoursDraft("１２", 5)).toEqual({ hours: 12, snapped: false });
    expect(resolveHoursDraft("１２３", 5)).toEqual({ hours: 40, snapped: true });
    expect(resolveHoursDraft("abc", 5)).toEqual({ hours: 5, snapped: false });
  });

  it("step a whole hour at a time, and stay put at a limit", () => {
    expect(stepGoalHours(5, 1)).toBe(6);
    expect(stepGoalHours(5, -1)).toBe(4);
    expect(stepGoalHours(39, 1)).toBe(40);
    expect(stepGoalHours(2, -1)).toBe(1);
    expect(stepGoalHours(40, 1)).toBe(40);
    expect(stepGoalHours(1, -1)).toBe(1);
  });

  it("step a stored quota the box can't set onto whole hours within range", () => {
    expect(stepGoalHours(2.5, 1)).toBe(3);
    expect(stepGoalHours(2.5, -1)).toBe(2);
    expect(stepGoalHours(1.5, -1)).toBe(1);
    expect(stepGoalHours(39.5, 1)).toBe(40);
    expect(stepGoalHours(60, -1)).toBe(40);
    expect(stepGoalHours(60, 1)).toBe(60);
    expect(stepGoalHours(0.5, 1)).toBe(1);
    expect(stepGoalHours(0.5, -1)).toBe(0.5);
  });

  it("show whole hours bare and anything else to one decimal", () => {
    expect(formatGoalHours(5)).toBe("5");
    expect(formatGoalHours(40)).toBe("40");
    expect(formatGoalHours(2.5)).toBe("2.5");
    expect(formatGoalHours(60)).toBe("60");
  });

  it("say the hours in words, one hour singular", () => {
    expect(hoursText(1)).toBe("1 hour a week");
    expect(hoursText(5)).toBe("5 hours a week");
    expect(hoursText(40)).toBe("40 hours a week");
    expect(hoursText(2.5)).toBe("2.5 hours a week");
  });
});

describe("habits (R:100-103)", () => {
  it("has the design's preset habits, exactly (R:101)", () => {
    expect(V3_HABITS).toEqual([
      "Drink water",
      "Meditate",
      "Journal",
      "Sub 1 hour Instagram",
      "Stretch",
    ]);
  });

  it("capitalizes a typed habit's first letter, tidies whitespace and caps it", () => {
    expect(formatHabitName("  floss   daily ")).toBe("Floss daily");
    expect(formatHabitName("   ")).toBe("");
    expect(formatHabitName("x".repeat(50))).toHaveLength(HABIT_NAME_MAX);
  });

  it("never leaves half an emoji, or a trailing space, at the habit cap", () => {
    const x31 = "X" + "x".repeat(30);
    expect(formatHabitName("x".repeat(31) + "😀")).toBe(x31 + "😀");
    expect(formatHabitName("x".repeat(31) + "🇺🇸")).toBe(x31);
    expect(formatHabitName("x".repeat(31) + "👍🏽")).toBe(x31);
    expect(formatHabitName("x".repeat(31) + " yz")).toBe(x31);
  });

  it("names the first habit in the nudge line, with the default when there's none (R:103)", () => {
    expect(habitNudgeText("Drink water")).toBe(
      "Friends can nudge you if “Drink water” is still open tonight."
    );
    const fallback = "If a habit’s still open at night, friends can send you a nudge.";
    expect(habitNudgeText(null)).toBe(fallback);
    expect(habitNudgeText(undefined)).toBe(fallback);
    expect(habitNudgeText("  ")).toBe(fallback);
  });
});

describe("inviteText (R:144, D9)", () => {
  it("names goal 1", () => {
    expect(inviteText("Get stronger")).toBe(
      "I’m putting real time toward “Get stronger” on Progra. Join so we can keep each other going."
    );
  });

  it("never invents a goal when there isn't one", () => {
    expect(inviteText("")).toBe(
      "I’m putting real time toward my goals on Progra. Join so we can keep each other going."
    );
    expect(inviteText(null)).not.toContain("“");
  });

  it("is sent with the App Store link, never progra.world/i/ (D9)", () => {
    const body = inviteBody(inviteText("Get stronger"));
    expect(body.endsWith(`\n${APP_STORE_URL}`)).toBe(true);
    expect(body).not.toContain("progra.world");
  });
});

describe("Screen 5 (R:130-143)", () => {
  it("uses the README's non-UW copy, exactly", () => {
    expect(FIND_FRIENDS_COPY.title).toBe("Find your friends");
    expect(FIND_FRIENDS_COPY.sub).toBe(
      "Your feed is your friends clocking in. Bring yours. It takes one message."
    );
    expect(FIND_FRIENDS_COPY.note).toBe(
      "Progra works best with people you already talk to. Here’s what your group chat gets:"
    );
    expect(FIND_FRIENDS_COPY.linkTitle).toBe("Join me on Progra");
  });

  it("skips quietly until someone's added, then counts them (R:143)", () => {
    expect(friendsCta(0)).toEqual({ label: "Skip for now", variant: "secondary" });
    expect(friendsCta(1)).toEqual({ label: "Continue · 1 added", variant: "primary" });
    expect(friendsCta(2)).toEqual({ label: "Continue · 2 added", variant: "primary" });
    expect(friendsCta(12)).toEqual({ label: "Continue · 12 added", variant: "primary" });
  });

  it("never counts below zero or in fractions", () => {
    expect(friendsCta(-1)).toEqual(friendsCta(0));
    expect(friendsCta(1.7)).toEqual(friendsCta(1));
  });
});

describe("readyNote (R:151, D13)", () => {
  it("says it lands in your feed when nobody was added", () => {
    expect(readyNote(0, 0)).toBe("It lands in your feed the moment you clock in.");
  });

  it("says they'll see it once they accept while every request is pending", () => {
    expect(readyNote(1, 1)).toBe("The 1 friend you added will see it once they accept.");
    expect(readyNote(2, 2)).toBe("The 2 friends you added will see it once they accept.");
  });

  it("says they'll see it in their feed once someone has accepted", () => {
    expect(readyNote(1, 0)).toBe("The 1 friend you added will see it in their feed.");
    expect(readyNote(2, 0)).toBe("The 2 friends you added will see it in their feed.");
    expect(readyNote(3, 2)).toBe("The 3 friends you added will see it in their feed.");
  });

  it("tolerates odd counts", () => {
    expect(readyNote(2, 5)).toBe("The 2 friends you added will see it once they accept.");
    expect(readyNote(-1, 0)).toBe("It lands in your feed the moment you clock in.");
  });
});

// ---- The reducer ------------------------------------------------------------

function run(actions: readonly WizardAction[], from: WizardState = initialWizardState()) {
  return actions.reduce(wizardReducer, from);
}

// The welcome with the UW sheet up, as its Continue leaves it (UW on).
const sheetUp = (): WizardState => run([{ type: "openUwSheet" }]);

describe("wizardReducer: moving between screens", () => {
  it("starts on Screen 1 with nothing chosen and the UW sheet down", () => {
    expect(initialWizardState()).toEqual({
      screen: 0,
      uwSheet: false,
      uwPage: false,
      uw: null,
      uwPhase: "choose",
      majors: [],
      interests: [],
      uwListed: false,
      goals: [],
      goalHours: [],
      goalRowIds: [],
      habits: [],
      customHabits: [],
      demo: "intro",
      demoGoal: 0,
    });
  });

  it("goes forward and back one screen at a time", () => {
    const s = run([{ type: "go", to: SCREEN.goal }, { type: "go", to: SCREEN.habits }]);
    expect(s.screen).toBe(SCREEN.habits);
    expect(wizardReducer(s, { type: "back" }).screen).toBe(SCREEN.goal);
  });

  it("has no Back on Screen 1 (R:35)", () => {
    const s = initialWizardState();
    expect(wizardReducer(s, { type: "back" })).toBe(s);
  });

  // The reducer steps back one screen, onto notifications. Stepping over it
  // when it isn't part of the run is the shell's (stepOverNotify).
  it("has Back on the ready screen", () => {
    const s = run([{ type: "go", to: SCREEN.ready }]);
    expect(wizardReducer(s, { type: "back" }).screen).toBe(SCREEN.notify);
  });

  it("returns the same state for a no-op move, and clamps a bad target", () => {
    const s = initialWizardState();
    expect(wizardReducer(s, { type: "go", to: 0 })).toBe(s);
    expect(wizardReducer(s, { type: "go", to: Number.NaN })).toBe(s);
    expect(wizardReducer(s, { type: "go", to: 99 }).screen).toBe(SCREEN.ready);
  });

  it("takes the UW sheet down on any move, so Back lands on the welcome without it", () => {
    const left = run([{ type: "pickUw", choice: "no" }, { type: "go", to: SCREEN.goal }], sheetUp());
    expect(left).toMatchObject({ screen: SCREEN.goal, uwSheet: false });
    expect(run([{ type: "back" }], left)).toMatchObject({ screen: SCREEN.identity, uwSheet: false });
  });

  it("resets the UW choice going back to Screen 1 after No (R:176)", () => {
    const s = run(
      [{ type: "pickUw", choice: "no" }, { type: "go", to: SCREEN.goal }, { type: "back" }],
      sheetUp()
    );
    expect(s.screen).toBe(SCREEN.identity);
    expect(s.uw).toBe(null);
    expect(s.uwPhase).toBe("choose");
  });

  it("keeps a Yes going back to Screen 1, and lands on the UW page", () => {
    const opened = run(
      [
        { type: "pickUw", choice: "yes" },
        { type: "openUw" },
        { type: "addMajor", value: "Economics" },
        { type: "go", to: SCREEN.goal },
        { type: "back" },
      ],
      sheetUp()
    );
    expect(opened).toMatchObject({
      uw: "yes",
      uwPhase: "open",
      uwPage: true,
      uwSheet: false,
      majors: ["Economics"],
    });

    const midway = run(
      [{ type: "pickUw", choice: "yes" }, { type: "go", to: SCREEN.goal }, { type: "back" }],
      sheetUp()
    );
    expect(midway).toMatchObject({ uw: "yes", uwPhase: "open", uwPage: true });
  });

  it("keeps majors and interests through a No reset, for a change of mind", () => {
    const s = run(
      [
        { type: "pickUw", choice: "yes" },
        { type: "openUw" },
        { type: "addMajor", value: "Economics" },
        { type: "addInterest", value: "Chess" },
        { type: "changeUw" },
        { type: "pickUw", choice: "no" },
        { type: "go", to: SCREEN.goal },
        { type: "back" },
      ],
      sheetUp()
    );
    expect(s).toMatchObject({ uw: null, majors: ["Economics"], interests: ["Chess"] });
  });

  it("restarts the practice run at its intro, on goal 1, whenever Screen 4 is entered", () => {
    const posted = run([
      { type: "addGoal", title: "Get stronger" },
      { type: "addGoal", title: "Learn Spanish" },
      { type: "go", to: SCREEN.intro },
      { type: "setDemo", demo: "ready" },
      { type: "pickDemoGoal", index: 1 },
      { type: "setDemo", demo: "posted" },
    ]);
    expect(posted).toMatchObject({ demo: "posted", demoGoal: 1 });
    const forward = run([{ type: "go", to: SCREEN.friends }, { type: "back" }], posted);
    expect(forward).toMatchObject({ screen: SCREEN.intro, demo: "intro", demoGoal: 0 });
    const fromBehind = run(
      [{ type: "go", to: SCREEN.habits }, { type: "go", to: SCREEN.intro }],
      { ...posted, screen: SCREEN.friends }
    );
    expect(fromBehind).toMatchObject({ demo: "intro", demoGoal: 0 });
  });

});

describe("wizardReducer: the UW sheet", () => {
  it("opens only over the welcome, and closes unanswered except mid-selection", () => {
    const up = sheetUp();
    expect(up.uwSheet).toBe(true);
    expect(wizardReducer(up, { type: "openUwSheet" })).toBe(up);
    expect(run([{ type: "closeUwSheet" }], up).uwSheet).toBe(false);
    const selecting = run([{ type: "pickUw", choice: "yes" }], up);
    expect(wizardReducer(selecting, { type: "closeUwSheet" })).toBe(selecting);
    const elsewhere = run([{ type: "go", to: SCREEN.goal }]);
    expect(wizardReducer(elsewhere, { type: "openUwSheet" })).toBe(elsewhere);
  });

  it("reopens on the answer as it was left, settled", () => {
    const tiles = run([{ type: "closeUwSheet" }, { type: "openUwSheet" }], sheetUp());
    expect(tiles).toMatchObject({ uwSheet: true, uw: null, uwPhase: "choose", uwPage: false });
    // A Yes left by Back from its page: Continue goes straight back to it.
    const open = run([{ type: "pickUw", choice: "yes" }, { type: "openUw" }], sheetUp());
    const again = run([{ type: "back" }, { type: "openUwSheet" }], open);
    expect(again).toMatchObject({ uwSheet: false, uwPage: true, uw: "yes", uwPhase: "open" });
    // A No left mid-selection (only the preview starts there) asks again.
    const heldNo: WizardState = { ...initialWizardState(), uw: "no", uwPhase: "selecting" };
    expect(run([{ type: "openUwSheet" }], heldNo)).toMatchObject({
      uwSheet: true,
      uw: null,
      uwPhase: "choose",
    });
  });
});

describe("wizardReducer: the UW choice", () => {
  it("takes a tile only from the tiles of a sheet that's up, on Screen 1", () => {
    const s = run([{ type: "pickUw", choice: "yes" }], sheetUp());
    expect(s).toMatchObject({ uw: "yes", uwPhase: "selecting" });
    // A second tap mid-animation can't switch the answer.
    expect(wizardReducer(s, { type: "pickUw", choice: "no" })).toBe(s);
    const down = initialWizardState();
    expect(wizardReducer(down, { type: "pickUw", choice: "yes" })).toBe(down);
    const elsewhere = run([{ type: "go", to: SCREEN.goal }], sheetUp());
    expect(wizardReducer(elsewhere, { type: "pickUw", choice: "yes" })).toBe(elsewhere);
  });

  it("opens the UW page only after Yes, taking the sheet down as it comes", () => {
    const no = run([{ type: "pickUw", choice: "no" }], sheetUp());
    expect(wizardReducer(no, { type: "openUw" })).toBe(no);
    expect(run([{ type: "pickUw", choice: "yes" }, { type: "openUw" }], sheetUp())).toMatchObject({
      uwPhase: "open",
      uwSheet: false,
      uwPage: true,
    });
  });

  it("goes Back from the UW page to the welcome, and nowhere from the welcome", () => {
    const page = run([{ type: "pickUw", choice: "yes" }, { type: "openUw" }], sheetUp());
    const welcome = run([{ type: "back" }], page);
    expect(welcome).toMatchObject({ screen: SCREEN.identity, uwPage: false, uwSheet: false });
    // The answer stays, for the next Continue.
    expect(welcome).toMatchObject({ uw: "yes", uwPhase: "open" });
    expect(wizardReducer(welcome, { type: "back" })).toBe(welcome);
  });

  it("leaves the UW page behind on Screen 2, and only ever holds it on Screen 1", () => {
    const page = run([{ type: "pickUw", choice: "yes" }, { type: "openUw" }], sheetUp());
    expect(run([{ type: "go", to: SCREEN.goal }], page)).toMatchObject({
      screen: SCREEN.goal,
      uwPage: false,
    });
    // A Yes that finishes its hold off Screen 1 (only a stale timer could)
    // opens no page.
    const off: WizardState = { ...sheetUp(), screen: SCREEN.goal, uw: "yes", uwPhase: "selecting" };
    expect(run([{ type: "openUw" }], off)).toMatchObject({ uwPhase: "open", uwPage: false });
  });

  it("Change goes from the UW page back to the question", () => {
    const s = run(
      [{ type: "pickUw", choice: "yes" }, { type: "openUw" }, { type: "changeUw" }],
      sheetUp()
    );
    expect(s).toMatchObject({ uw: null, uwPhase: "choose", uwSheet: true, uwPage: false });
    expect(wizardReducer(s, { type: "changeUw" })).toBe(s);
  });

  it("lists only on a Yes tap, the one next to the disclosure (D2)", () => {
    expect(run([{ type: "pickUw", choice: "yes" }], sheetUp()).uwListed).toBe(true);
    expect(run([{ type: "pickUw", choice: "no" }], sheetUp()).uwListed).toBe(false);
    // A replayer who unlisted in Settings starts open and unlisted; only
    // tapping Yes again lists them.
    const unlisted: WizardState = { ...sheetUp(), uw: "yes", uwPhase: "open" };
    expect(run([{ type: "openUw" }, { type: "setMajors", majors: ["Art"] }], unlisted).uwListed).toBe(
      false
    );
    const again = run([{ type: "changeUw" }, { type: "pickUw", choice: "yes" }], unlisted);
    expect(again).toMatchObject({ uwPhase: "selecting", uwListed: true });
    // Change keeps whatever the listing was; No doesn't touch it either
    // (leaving unlists anyway, server-side).
    const listedThenNo = run(
      [
        { type: "pickUw", choice: "yes" },
        { type: "openUw" },
        { type: "changeUw" },
        { type: "pickUw", choice: "no" },
      ],
      sheetUp()
    );
    expect(listedThenNo).toMatchObject({ uw: "no", uwListed: true });
  });

  it("can't take or switch an answer once Screen 1 is left", () => {
    const s = run([{ type: "pickUw", choice: "no" }, { type: "go", to: SCREEN.goal }], sheetUp());
    expect(wizardReducer(s, { type: "pickUw", choice: "yes" })).toBe(s);
  });
});

describe("wizardReducer: the quick-add's lists", () => {
  it("takes a chip field's whole list, through the action's cleaners", () => {
    const s = run([
      { type: "setMajors", majors: ["computer   science", "Computer Science", "Basket Weaving"] },
      { type: "setInterests", interests: [" Chess ", "chess", "AI"] },
    ]);
    expect(s.majors).toEqual(["Computer Science", "Basket Weaving"]);
    expect(s.interests).toEqual(["Chess", "AI"]);
  });

  it("caps the lists at the cleaners' limits", () => {
    const s = run([
      { type: "setMajors", majors: ["Economics", "Art", "Music", "History"] },
      { type: "setInterests", interests: ["a", "b", "c", "d", "e", "f", "g"] },
    ]);
    expect(s.majors).toHaveLength(MAX_UW_MAJORS);
    expect(s.interests).toHaveLength(MAX_UW_INTERESTS);
  });

  it("returns the same state for a list that's already held", () => {
    const s = run([{ type: "setMajors", majors: ["Economics"] }]);
    expect(wizardReducer(s, { type: "setMajors", majors: ["economics "] })).toBe(s);
    expect(wizardReducer(s, { type: "setInterests", interests: [] })).toBe(s);
  });

  it("empties a list", () => {
    const s = run([{ type: "setMajors", majors: ["Economics"] }, { type: "setMajors", majors: [] }]);
    expect(s.majors).toEqual([]);
  });
});

describe("wizardReducer: lists", () => {
  it("keeps at most 3 goals, trimmed, and ignores an empty one", () => {
    const s = run([
      { type: "addGoal", title: "  Get   stronger " },
      { type: "addGoal", title: "   " },
      { type: "addGoal", title: "Learn Spanish" },
      { type: "addGoal", title: "Finish my thesis" },
      { type: "addGoal", title: "One too many" },
    ]);
    expect(MAX_GOALS).toBe(3);
    expect(s.goals).toEqual(["Get stronger", "Learn Spanish", "Finish my thesis"]);
    expect(wizardReducer(s, { type: "addGoal", title: "x" })).toBe(s);
  });

  it("caps a goal title at 60 characters", () => {
    expect(run([{ type: "addGoal", title: "g".repeat(80) }]).goals[0]).toHaveLength(GOAL_TITLE_MAX);
  });

  it("never leaves a lone surrogate or half an emoji at the goal cap", () => {
    const g59 = "g".repeat(59);
    expect(run([{ type: "addGoal", title: g59 + "😀😀" }]).goals[0]).toBe(g59 + "😀");
    expect(run([{ type: "addGoal", title: g59 + "🇺🇸" }]).goals[0]).toBe(g59);
    expect(run([{ type: "addGoal", title: g59 + "👍🏽" }]).goals[0]).toBe(g59);
  });

  it("removes a goal by position, ignoring a bad index", () => {
    const s = run([
      { type: "addGoal", title: "A" },
      { type: "addGoal", title: "B" },
    ]);
    expect(wizardReducer(s, { type: "removeGoal", index: 0 }).goals).toEqual(["B"]);
    expect(wizardReducer(s, { type: "removeGoal", index: 5 })).toBe(s);
    expect(wizardReducer(s, { type: "removeGoal", index: -1 })).toBe(s);
    expect(wizardReducer(s, { type: "removeGoal", index: 0.5 })).toBe(s);
  });

  it("canonicalizes majors to the list's spelling, de-duplicates and caps at 3", () => {
    const s = run([
      { type: "addMajor", value: "computer   science" },
      { type: "addMajor", value: "Computer Science" },
      { type: "addMajor", value: "Other" },
      { type: "addMajor", value: "" },
      { type: "addMajor", value: "economics" },
      { type: "addMajor", value: "Underwater Basket Weaving" },
      { type: "addMajor", value: "Informatics" },
    ]);
    expect(MAX_UW_MAJORS).toBe(3);
    expect(s.majors).toEqual(["Computer Science", "Economics", "Underwater Basket Weaving"]);
    expect(wizardReducer(s, { type: "removeMajor", index: 1 }).majors).toEqual([
      "Computer Science",
      "Underwater Basket Weaving",
    ]);
  });

  it("de-duplicates interests ignoring case and caps at 6", () => {
    const s = run(
      ["Chess", "chess", " AI ", "Running", "Hiking", "Film", "Music", "Cooking"].map(
        (value): WizardAction => ({ type: "addInterest", value })
      )
    );
    expect(MAX_UW_INTERESTS).toBe(6);
    expect(s.interests).toEqual(["Chess", "AI", "Running", "Hiking", "Film", "Music"]);
    expect(wizardReducer(s, { type: "removeInterest", index: 0 }).interests).toHaveLength(5);
  });

  it("toggles habits, keeping pick order", () => {
    const s = run([
      { type: "toggleHabit", name: "Stretch" },
      { type: "toggleHabit", name: "Journal" },
    ]);
    expect(s.habits).toEqual(["Stretch", "Journal"]);
    expect(wizardReducer(s, { type: "toggleHabit", name: "Stretch" }).habits).toEqual(["Journal"]);
  });

  it("adds a typed habit as a selected chip", () => {
    const s = run([{ type: "addCustomHabit", name: "floss" }]);
    expect(s).toMatchObject({ customHabits: ["Floss"], habits: ["Floss"] });
  });

  it("selects the existing chip for a habit that's already there, whatever its case", () => {
    const s = run([{ type: "addCustomHabit", name: "drink WATER" }]);
    expect(s).toMatchObject({ customHabits: [], habits: ["Drink water"] });
    expect(wizardReducer(s, { type: "addCustomHabit", name: "drink water" })).toBe(s);
    expect(wizardReducer(s, { type: "addCustomHabit", name: "  " })).toBe(s);
  });
});

describe("wizardReducer: goal hours (OWNER-FIX-2)", () => {
  it("adds each goal at 5h unless it's given hours", () => {
    const s = run([
      { type: "addGoal", title: "A" },
      { type: "addGoal", title: "B", hours: 12 },
    ]);
    expect(s.goals).toEqual(["A", "B"]);
    expect(s.goalHours).toEqual([5, 12]);
  });

  it("keeps hours it's given as they are, a quota the box can't set included", () => {
    expect(run([{ type: "addGoal", title: "A", hours: 2.5 }]).goalHours).toEqual([2.5]);
    expect(run([{ type: "addGoal", title: "A", hours: 60 }]).goalHours).toEqual([60]);
  });

  it("adds a goal given hours that aren't a quota at 5h", () => {
    for (const hours of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(run([{ type: "addGoal", title: "A", hours }]).goalHours).toEqual([5]);
    }
  });

  it("adds no hours for a goal it doesn't add", () => {
    const full = run([
      { type: "addGoal", title: "A" },
      { type: "addGoal", title: "B" },
      { type: "addGoal", title: "C", hours: 7 },
    ]);
    expect(full.goalHours).toEqual([5, 5, 7]);
    expect(wizardReducer(full, { type: "addGoal", title: "D", hours: 9 })).toBe(full);
    const empty = initialWizardState();
    expect(wizardReducer(empty, { type: "addGoal", title: "  ", hours: 9 })).toBe(empty);
  });

  it("removes a goal's hours with it", () => {
    const s = run([
      { type: "addGoal", title: "A" },
      { type: "addGoal", title: "B", hours: 8 },
      { type: "addGoal", title: "C", hours: 3 },
    ]);
    const after = wizardReducer(s, { type: "removeGoal", index: 1 });
    expect(after.goals).toEqual(["A", "C"]);
    expect(after.goalHours).toEqual([5, 3]);
  });

  it("sets a goal's hours, rounded and kept within 1-40", () => {
    const s = run([
      { type: "addGoal", title: "A" },
      { type: "addGoal", title: "B" },
    ]);
    expect(wizardReducer(s, { type: "setGoalHours", index: 1, hours: 12 }).goalHours).toEqual([5, 12]);
    expect(wizardReducer(s, { type: "setGoalHours", index: 0, hours: 12.6 }).goalHours).toEqual([13, 5]);
    expect(wizardReducer(s, { type: "setGoalHours", index: 0, hours: 0 }).goalHours).toEqual([1, 5]);
    expect(wizardReducer(s, { type: "setGoalHours", index: 0, hours: 99 }).goalHours).toEqual([40, 5]);
    // The goals themselves are untouched.
    expect(wizardReducer(s, { type: "setGoalHours", index: 0, hours: 9 }).goals).toBe(s.goals);
  });

  it("returns the same state for a bad index, a non-number, or the hours already held", () => {
    const s = run([{ type: "addGoal", title: "A", hours: 2.5 }]);
    for (const index of [1, -1, 0.5, Number.NaN]) {
      expect(wizardReducer(s, { type: "setGoalHours", index, hours: 9 })).toBe(s);
    }
    expect(wizardReducer(s, { type: "setGoalHours", index: 0, hours: Number.NaN })).toBe(s);
    const eight = wizardReducer(s, { type: "setGoalHours", index: 0, hours: 8 });
    expect(wizardReducer(eight, { type: "setGoalHours", index: 0, hours: 8 })).toBe(eight);
    expect(wizardReducer(eight, { type: "setGoalHours", index: 0, hours: 8.2 })).toBe(eight);
    // A stored 2.5 set through a box becomes whole hours.
    expect(wizardReducer(s, { type: "setGoalHours", index: 0, hours: 2.5 }).goalHours).toEqual([3]);
  });

  it("never lets the goals and their hours misalign, whatever comes (scripted)", () => {
    const script: WizardAction[] = [
      { type: "go", to: SCREEN.goal },
      { type: "addGoal", title: "A" },
      { type: "setGoalHours", index: 0, hours: 12 },
      { type: "addGoal", title: "B", hours: 2.5 },
      { type: "addGoal", title: "  " },
      { type: "addGoal", title: "C" },
      { type: "addGoal", title: "D", hours: 9 },
      { type: "removeGoal", index: 0 },
      { type: "setGoalHours", index: 5, hours: 3 },
      { type: "removeGoal", index: 9 },
      { type: "setGoalHours", index: 1, hours: 41 },
      { type: "toggleHabit", name: "Stretch" },
      { type: "back" },
      { type: "go", to: SCREEN.goal },
      { type: "addGoal", title: "A", hours: 12 },
      { type: "removeGoal", index: 1 },
      { type: "addGoal", title: "B" },
      { type: "setGoalHours", index: 2, hours: 1 },
    ];
    let s = initialWizardState();
    for (const action of script) {
      s = wizardReducer(s, action);
      expect(s.goalHours, JSON.stringify(action)).toHaveLength(s.goals.length);
      expect(s.goalRowIds, JSON.stringify(action)).toHaveLength(s.goals.length);
    }
    expect(s.goals).toEqual(["B", "A", "B"]);
    expect(s.goalHours).toEqual([2.5, 12, 1]);
  });
});

describe("wizardReducer: the row each goal is on (D1)", () => {
  it("adds a goal on the row it's given, or on none", () => {
    const s = run([
      { type: "addGoal", title: "A", rowId: "g1" },
      { type: "addGoal", title: "B" },
      { type: "addGoal", title: "C", rowId: null },
    ]);
    expect(s.goalRowIds).toEqual(["g1", null, null]);
  });

  it("never puts two goals on one row", () => {
    const s = run([
      { type: "addGoal", title: "Run", rowId: "g1" },
      { type: "addGoal", title: "Run", rowId: "g1" },
      { type: "addGoal", title: "B", rowId: "" },
    ]);
    expect(s.goalRowIds).toEqual(["g1", null, null]);
  });

  it("adds no row for a goal it doesn't add", () => {
    const empty = initialWizardState();
    expect(wizardReducer(empty, { type: "addGoal", title: "  ", rowId: "g1" })).toBe(empty);
  });

  it("removes a goal's row with it", () => {
    const s = run([
      { type: "addGoal", title: "A", rowId: "g1" },
      { type: "addGoal", title: "B", rowId: "g2" },
      { type: "addGoal", title: "C" },
    ]);
    const after = wizardReducer(s, { type: "removeGoal", index: 1 });
    expect(after.goals).toEqual(["A", "C"]);
    expect(after.goalRowIds).toEqual(["g1", null]);
    // And the row it gave up can be taken by a goal typed later.
    expect(wizardReducer(after, { type: "addGoal", title: "B", rowId: "g2" }).goalRowIds).toEqual([
      "g1",
      null,
      "g2",
    ]);
  });

  it("records the rows a save left the goals on, for the list it saved", () => {
    const s = run([
      { type: "addGoal", title: "A" },
      { type: "addGoal", title: "B", hours: 8 },
    ]);
    const saved = wizardReducer(s, { type: "setGoalRowIds", ids: ["w1", "w2"], goals: ["A", "B"] });
    expect(saved.goalRowIds).toEqual(["w1", "w2"]);
    expect(saved.goals).toBe(s.goals);
    expect(saved.goalHours).toBe(s.goalHours);
    // The same ids again change nothing.
    expect(
      wizardReducer(saved, { type: "setGoalRowIds", ids: ["w1", "w2"], goals: ["A", "B"] })
    ).toBe(saved);
    // A partial save: the goal whose create didn't land stays on none.
    expect(
      wizardReducer(s, { type: "setGoalRowIds", ids: ["w1", null], goals: ["A", "B"] }).goalRowIds
    ).toEqual(["w1", null]);
  });

  it("drops ids for a list that changed since, or that don't fit it", () => {
    const s = run([
      { type: "addGoal", title: "A" },
      { type: "addGoal", title: "B" },
    ]);
    expect(wizardReducer(s, { type: "setGoalRowIds", ids: ["w1", "w2"], goals: ["A"] })).toBe(s);
    expect(wizardReducer(s, { type: "setGoalRowIds", ids: ["w1", "w2"], goals: ["B", "A"] })).toBe(s);
    expect(wizardReducer(s, { type: "setGoalRowIds", ids: ["w1"], goals: ["A", "B"] })).toBe(s);
    // A row named twice stays with the first goal that names it.
    expect(
      wizardReducer(s, { type: "setGoalRowIds", ids: ["w1", "w1"], goals: ["A", "B"] }).goalRowIds
    ).toEqual(["w1", null]);
  });

  it("never lets the goals, their hours and their rows misalign, whatever comes (fuzzed)", () => {
    // mulberry32, so a failure names the seed that replays it.
    const seeded = (seed: number) => {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    for (let seed = 1; seed <= 300; seed++) {
      const rand = seeded(seed);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
      const id = () => (rand() < 0.3 ? null : pick(["r1", "r2", "r3", "r4", ""]));
      let s = initialWizardState();
      for (let move = 0; move < 60; move++) {
        const roll = rand();
        const index = Math.floor(rand() * 5) - 1;
        let action: WizardAction;
        if (roll < 0.3) {
          action = {
            type: "addGoal",
            title: pick(["Run", "run", "  ", "Read more", "A"]),
            hours: pick([5, 2.5, 60, 0, Number.NaN]),
            rowId: id(),
          };
        } else if (roll < 0.5) {
          action = { type: "removeGoal", index };
        } else if (roll < 0.65) {
          action = { type: "setGoalHours", index, hours: pick([1, 9, 41, 2.5, Number.NaN]) };
        } else if (roll < 0.9) {
          // A save's ids: for this list, or one that has since changed, and
          // sometimes one id too many or too few.
          const ids = s.goals.map(id);
          const n = rand();
          action = {
            type: "setGoalRowIds",
            ids: n < 0.1 ? [...ids, "r9"] : n < 0.2 ? ids.slice(1) : ids,
            goals: rand() < 0.85 ? s.goals : [...s.goals.slice(1), "Other"],
          };
        } else {
          action = pick<WizardAction>([
            { type: "go", to: SCREEN.goal },
            { type: "back" },
            { type: "toggleHabit", name: "Stretch" },
          ]);
        }
        s = wizardReducer(s, action);
        const at = `seed ${seed}: ${JSON.stringify(action)}`;
        expect(s.goalHours, at).toHaveLength(s.goals.length);
        expect(s.goalRowIds, at).toHaveLength(s.goals.length);
        const named = s.goalRowIds.filter((r) => r !== null);
        expect(new Set(named).size, at).toBe(named.length);
        expect(named, at).not.toContain("");
      }
    }
  });
});

describe("wizardReducer: the practice run", () => {
  const intro = run([
    { type: "addGoal", title: "Get stronger" },
    { type: "addGoal", title: "Learn Spanish" },
    { type: "go", to: SCREEN.intro },
  ]);
  const ready = wizardReducer(intro, { type: "setDemo", demo: "ready" });

  it("moves between phases, and returns the same state for the phase it's on", () => {
    expect(ready.demo).toBe("ready");
    expect(wizardReducer(ready, { type: "setDemo", demo: "ready" })).toBe(ready);
    expect(wizardReducer(ready, { type: "setDemo", demo: "running" }).demo).toBe("running");
  });

  it("ignores an unknown phase", () => {
    const bad = { type: "setDemo", demo: "nope" } as unknown as WizardAction;
    expect(wizardReducer(ready, bad)).toBe(ready);
  });

  it("picks a goal only on the ready phase, clamped to the goals there are", () => {
    expect(wizardReducer(ready, { type: "pickDemoGoal", index: 1 }).demoGoal).toBe(1);
    expect(wizardReducer(ready, { type: "pickDemoGoal", index: 9 }).demoGoal).toBe(1);
    expect(wizardReducer(ready, { type: "pickDemoGoal", index: -2 })).toBe(ready);
    expect(wizardReducer(ready, { type: "pickDemoGoal", index: Number.NaN })).toBe(ready);
    expect(wizardReducer(intro, { type: "pickDemoGoal", index: 1 })).toBe(intro);
  });

  it("ignores its actions off Screen 4, so a late timer can't move it", () => {
    const habits = { ...ready, screen: SCREEN.habits };
    for (const action of [
      { type: "setDemo", demo: "ended" },
      { type: "pickDemoGoal", index: 1 },
    ] satisfies WizardAction[]) {
      expect(wizardReducer(habits, action)).toBe(habits);
    }
  });
});

