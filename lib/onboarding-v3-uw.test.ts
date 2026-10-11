import { describe, expect, it } from "vitest";

import { ITEM_ENTER, itemStyle } from "@/lib/motion";
import {
  SCREEN,
  initialWizardState,
  wizardReducer,
  type UwChoice,
  type UwPhase,
  type WizardAction,
  type WizardState,
} from "@/lib/onboarding-v3";
import { welcomeContinue } from "@/lib/onboarding-v3-identity";
import {
  QUICK_ADD_REVEAL_PX,
  SHEET_DRAG,
  UW_COPY,
  UW_PAGE_STAGGER,
  UW_TIMING,
  hasUwInput,
  quickAddScrollTop,
  savedUwFrom,
  sheetDragDismisses,
  sheetArmMs,
  sheetDragOffset,
  sheetTapCounts,
  uwBarNote,
  uwDelay,
  uwExitInput,
  uwPageCta,
  uwSheetDismissible,
  uwStartState,
  uwStoredInput,
  uwTileStyle,
  uwTileTap,
  uwTilesInteractive,
  uwTilesNote,
  uwWriteNeeded,
  type UwView,
} from "@/lib/onboarding-v3-uw";
import { MAX_UW_INTERESTS, MAX_UW_MAJORS, uwProfilePayload } from "@/lib/uw";
import { UW_LISTED_DISCLOSURE, type SavedUw } from "@/lib/uw-fields";

function run(actions: readonly WizardAction[], from: WizardState = initialWizardState()) {
  return actions.reduce(wizardReducer, from);
}

// The welcome's Continue with UW on, once its identity has saved, as the shell
// runs it: welcomeContinue says where to, and the reducer opens the sheet.
function continueWelcome(s: WizardState, uwEnabled = true): WizardState {
  const plan = welcomeContinue({ uwEnabled, valid: true, saving: false });
  if (plan.kind === "ignore") return s;
  return wizardReducer(
    s,
    plan.then === "uwSheet" ? { type: "openUwSheet" } : { type: "go", to: SCREEN.goal }
  );
}

// A tile tap as the shell decides it: uwTileTap, then pickUw.
function tap(s: WizardState, choice: UwChoice, busy = false) {
  const d = uwTileTap({ screen: s.screen, uwSheet: s.uwSheet, uwPhase: s.uwPhase, busy });
  return { d, state: d === "select" ? wizardReducer(s, { type: "pickUw", choice }) : s };
}

const dismiss = (s: WizardState, busy = false) =>
  uwSheetDismissible({ uwSheet: s.uwSheet, uwPhase: s.uwPhase, busy })
    ? wizardReducer(s, { type: "closeUwSheet" })
    : s;

describe("copy", () => {
  it("is the README's, word for word (R:75-88), the question as the sheet's title", () => {
    expect(UW_COPY.question).toBe("Are you a UW student?");
    expect(UW_COPY.yes).toEqual({ label: "Yes", sub: "Find UW friends" });
    expect(UW_COPY.no).toEqual({ label: "No", sub: "Bring your own crew" });
    expect(UW_COPY.bar).toBe("UW student");
    expect(UW_COPY.change).toBe("Change");
    expect(UW_COPY.eyebrow).toBe("Optional: helps us suggest UW friends");
  });

  it("puts D2's disclosure under the bar, and no line when this student isn't listed", () => {
    expect(uwBarNote(true)).toBe(UW_LISTED_DISCLOSURE);
    expect(UW_LISTED_DISCLOSURE).toBe("UW students on Progra will see you're at UW and your major.");
    expect(uwBarNote(false)).toBeNull();
  });

  it("says under the tiles what No clears, only for someone in the cohort", () => {
    expect(uwTilesNote(true)).toBe(
      "Choosing No takes you out of UW groups and clears your majors and interests."
    );
    expect(uwTilesNote(false)).toBeNull();
    // What it describes is what No saves: out of the cohort, lists and listing
    // cleared (uwProfilePayload).
    expect(uwExitInput({ kind: "no" })).toEqual({ isUw: false });
  });
});

describe("sheetTapCounts: taps count once the sheet is up", () => {
  it("ignores every tap while it's still rising", () => {
    expect(sheetTapCounts(null, 50, 1)).toBe(false);
    expect(sheetTapCounts(null, 50, 0)).toBe(false);
  });

  it("ignores the second tap of a double tap on Continue, pressed before it was up", () => {
    // Armed at 440ms; the finger went down at 300ms and lifted after.
    expect(sheetTapCounts(440, 300, 1)).toBe(false);
  });

  it("counts a tap pressed once it's up, and a keyboard's click, which has no press", () => {
    expect(sheetTapCounts(440, 900, 1)).toBe(true);
    expect(sheetTapCounts(440, 440, 1)).toBe(true);
    expect(sheetTapCounts(440, -Infinity, 0)).toBe(true);
  });

  it("arms as the rise ends", () => {
    expect(sheetArmMs(false)).toBe(440);
    expect(sheetArmMs(true)).toBe(200);
  });
});

describe("timing", () => {
  it("is R:79-80's, shorter under reduced motion as in the prototype", () => {
    expect(uwDelay("noAdvanceMs", false)).toBe(780);
    expect(uwDelay("yesOpenMs", false)).toBe(320);
    expect(uwDelay("majorFocusMs", false)).toBe(480);
    for (const t of Object.values(UW_TIMING)) expect(t.reduced).toBeLessThan(t.normal);
  });
});

// ---- The sheet's state machine ------------------------------------------------

describe("the welcome's Continue and the sheet", () => {
  it("raises the sheet over the welcome with UW on, on its tiles", () => {
    const s = continueWelcome(initialWizardState());
    expect(s).toMatchObject({ screen: SCREEN.identity, uwSheet: true, uw: null, uwPhase: "choose" });
  });

  it("goes straight to Screen 2 with UW off, no sheet", () => {
    const s = continueWelcome(initialWizardState(), false);
    expect(s).toMatchObject({ screen: SCREEN.goal, uwSheet: false });
  });

  it("only opens over the welcome, and once", () => {
    const up = continueWelcome(initialWizardState());
    expect(wizardReducer(up, { type: "openUwSheet" })).toBe(up);
    const elsewhere = run([{ type: "go", to: SCREEN.goal }]);
    expect(wizardReducer(elsewhere, { type: "openUwSheet" })).toBe(elsewhere);
  });

  it("starts down, and a tile can't be taken until it's up", () => {
    const s = initialWizardState();
    expect(s.uwSheet).toBe(false);
    expect(tap(s, "yes").d).toBe("ignore");
    expect(wizardReducer(s, { type: "pickUw", choice: "yes" })).toBe(s);
  });
});

describe("the sheet: choose, selecting, open", () => {
  const up = () => continueWelcome(initialWizardState());

  it("Yes: select, open the bar, add, and the CTA goes Skip → Continue", () => {
    let s = tap(up(), "yes").state;
    expect(s).toMatchObject({ uw: "yes", uwPhase: "selecting", uwListed: true });
    expect(uwPageCta({ uwPhase: s.uwPhase, hasUwInput: false })).toBeNull();
    // A second tap during the selected state does nothing.
    expect(tap(s, "no").d).toBe("ignore");
    expect(wizardReducer(s, { type: "pickUw", choice: "no" })).toBe(s);

    s = run([{ type: "openUw" }], s);
    expect(s.uwPhase).toBe("open");
    expect(uwPageCta({ uwPhase: s.uwPhase, hasUwInput: hasUwInput(s.majors, s.interests, false) })).toEqual({
      label: "Skip for now",
      variant: "secondary",
    });
    s = run([{ type: "setMajors", majors: ["Economics"] }], s);
    expect(uwPageCta({ uwPhase: s.uwPhase, hasUwInput: hasUwInput(s.majors, s.interests, false) })).toEqual({
      label: "Continue",
      variant: "primary",
    });
  });

  it("No: select, and the tiles stay out of reach while it saves", () => {
    const s = tap(up(), "no").state;
    expect(s).toMatchObject({ uw: "no", uwPhase: "selecting", uwSheet: true });
    expect(tap(s, "yes").d).toBe("ignore");
    expect(wizardReducer(s, { type: "openUw" })).toBe(s);
  });

  it("Change goes back to the tiles, keeping the lists for a change of mind", () => {
    const open = run(
      [{ type: "openUw" }, { type: "setMajors", majors: ["Economics"] }],
      tap(up(), "yes").state
    );
    const s = run([{ type: "changeUw" }], open);
    expect(s).toMatchObject({ uw: null, uwPhase: "choose", uwSheet: true, majors: ["Economics"] });
    expect(wizardReducer(s, { type: "changeUw" })).toBe(s);
    expect(tap(s, "no").d).toBe("select");
  });

  it("a failed No write puts the tiles back to ask again", () => {
    const s = run([{ type: "changeUw" }], tap(up(), "no").state);
    expect(s).toMatchObject({ uw: null, uwPhase: "choose", uwSheet: true });
    expect(tap(s, "no").d).toBe("select");
  });

  it("ignores a tile while a save is in flight", () => {
    expect(tap(up(), "yes", true).d).toBe("ignore");
  });

  it("lists only on a Yes tap in the sheet, the one next to the disclosure (D2)", () => {
    expect(tap(up(), "yes").state.uwListed).toBe(true);
    expect(tap(up(), "no").state.uwListed).toBe(false);
    const unlisted: WizardState = {
      ...initialWizardState(),
      ...uwStartState({ isUw: true, majors: ["Art"], interests: [], listed: false }, true),
    };
    // A replayer who unlisted in Settings goes straight to the UW page,
    // unlisted; only tapping Yes again lists them.
    const reopened = continueWelcome(unlisted);
    expect(reopened).toMatchObject({ uwSheet: false, uwPage: true, uwPhase: "open", uwListed: false });
    expect(run([{ type: "setMajors", majors: ["Art", "Music"] }], reopened).uwListed).toBe(false);
    const again = run([{ type: "changeUw" }], reopened);
    expect(tap(again, "yes").state).toMatchObject({ uwPhase: "selecting", uwListed: true });
    // No doesn't touch the flag: leaving unlists anyway, server-side.
    expect(tap(again, "no").state.uwListed).toBe(false);
  });
});

describe("the sheet: put away unanswered", () => {
  const up = () => continueWelcome(initialWizardState());

  it("closes onto the welcome and the next Continue shows it as it was left", () => {
    const tiles = dismiss(up());
    expect(tiles).toMatchObject({ screen: SCREEN.identity, uwSheet: false, uwPhase: "choose" });
    expect(continueWelcome(tiles)).toMatchObject({ uwSheet: true, uw: null, uwPhase: "choose" });

    // A Yes is on its page, which Back leaves for the welcome; the next
    // Continue goes straight back to the page as it was.
    const page = run(
      [{ type: "openUw" }, { type: "setInterests", interests: ["Chess"] }],
      tap(up(), "yes").state
    );
    expect(page).toMatchObject({ uwSheet: false, uwPage: true });
    expect(dismiss(page)).toBe(page);
    const welcome = run([{ type: "back" }], page);
    expect(welcome).toMatchObject({ uwPage: false, uw: "yes", uwPhase: "open", interests: ["Chess"] });
    expect(continueWelcome(welcome)).toMatchObject({
      uwSheet: false,
      uwPage: true,
      uw: "yes",
      uwPhase: "open",
      interests: ["Chess"],
      uwListed: true,
    });
  });

  it("can't be put away while a tile plays its selected state, or mid-save", () => {
    const selecting = tap(up(), "no").state;
    expect(uwSheetDismissible({ uwSheet: true, uwPhase: "selecting", busy: false })).toBe(false);
    expect(dismiss(selecting)).toBe(selecting);
    // The reducer holds the line too.
    expect(wizardReducer(selecting, { type: "closeUwSheet" })).toBe(selecting);
    const open = run([{ type: "openUw" }], tap(up(), "yes").state);
    expect(uwSheetDismissible({ uwSheet: true, uwPhase: "open", busy: true })).toBe(false);
    expect(dismiss(open, true)).toBe(open);
    expect(uwSheetDismissible({ uwSheet: false, uwPhase: "choose", busy: false })).toBe(false);
    const down = initialWizardState();
    expect(wizardReducer(down, { type: "closeUwSheet" })).toBe(down);
  });
});

describe("the sheet and the screens around it", () => {
  const up = () => continueWelcome(initialWizardState());

  it("goes down as the wizard moves on, and Back from Screen 2 lands on the UW page", () => {
    const yes = run(
      [{ type: "openUw" }, { type: "go", to: SCREEN.goal }],
      tap(up(), "yes").state
    );
    expect(yes).toMatchObject({ screen: SCREEN.goal, uwSheet: false, uwPage: false });
    const back = run([{ type: "back" }], yes);
    expect(back).toMatchObject({
      screen: SCREEN.identity,
      uwSheet: false,
      uwPage: true,
      uw: "yes",
      uwPhase: "open",
    });
    // Back again is the welcome, and Continue the page once more.
    const welcome = run([{ type: "back" }], back);
    expect(welcome).toMatchObject({ uwPage: false, uwSheet: false });
    expect(continueWelcome(welcome)).toMatchObject({ uwPage: true, uwSheet: false });
  });

  it("asks again after No and Back (R:176), keeping the lists", () => {
    const s = run(
      [
        { type: "openUw" },
        { type: "setMajors", majors: ["Economics"] },
        { type: "changeUw" },
        { type: "pickUw", choice: "no" },
        { type: "go", to: SCREEN.goal },
        { type: "back" },
      ],
      tap(up(), "yes").state
    );
    expect(s).toMatchObject({ screen: SCREEN.identity, uwSheet: false, uw: null, uwPhase: "choose" });
    expect(s.majors).toEqual(["Economics"]);
    expect(continueWelcome(s)).toMatchObject({ uwSheet: true, uwPhase: "choose" });
  });

  it("lands a Yes left mid-animation on the open bar", () => {
    const s = run([{ type: "go", to: SCREEN.goal }, { type: "back" }], tap(up(), "yes").state);
    expect(s).toMatchObject({ uw: "yes", uwPhase: "open", uwSheet: false });
  });

  it("is never up past the welcome, and no tile is taken there", () => {
    const s = run([{ type: "go", to: SCREEN.habits }], up());
    expect(s.uwSheet).toBe(false);
    expect(tap(s, "yes").d).toBe("ignore");
    expect(wizardReducer(s, { type: "pickUw", choice: "yes" })).toBe(s);
  });
});

// ---- What each way out saves ---------------------------------------------------

describe("what each way out of the sheet saves", () => {
  it("No leaves the cohort: everything cleared and unlisted", () => {
    const input = uwExitInput({ kind: "no" });
    expect(input).toEqual({ isUw: false });
    expect(uwProfilePayload(input)).toEqual({
      is_uw: false,
      uw_majors: null,
      uw_interests: null,
      uw_listed: false,
      uw_share_goals: false,
      uw_major: null,
      uw_clubs: null,
    });
  });

  it("Skip saves Yes with no lists, listed after a Yes tap", () => {
    const s = run(
      [{ type: "openUwSheet" }, { type: "pickUw", choice: "yes" }, { type: "openUw" }]
    );
    const input = uwExitInput({ kind: "yes", majors: s.majors, interests: s.interests, listed: s.uwListed });
    expect(uwProfilePayload(input)).toEqual({
      is_uw: true,
      uw_majors: null,
      uw_interests: null,
      uw_listed: true,
      uw_share_goals: false,
      uw_major: null,
      uw_clubs: null,
    });
  });

  it("Continue saves the cleaned lists and the listing as given", () => {
    const input = uwExitInput({
      kind: "yes",
      majors: ["computer science", "Econ"],
      interests: ["Chess", " chess ", "AI"],
      listed: true,
    });
    expect(input).toEqual({
      isUw: true,
      majors: ["Computer Science", "Econ"],
      interests: ["Chess", "AI"],
      listed: true,
    });
    expect(uwProfilePayload(input)).toMatchObject({
      uw_majors: ["Computer Science", "Econ"],
      uw_interests: ["Chess", "AI"],
      uw_listed: true,
    });
    const unlisted = uwExitInput({ kind: "yes", majors: [], interests: [], listed: false });
    expect(uwProfilePayload(unlisted)?.uw_listed).toBe(false);
  });

  it("never saves more than the caps", () => {
    const input = uwExitInput({
      kind: "yes",
      majors: ["Economics", "Art", "Music", "History"],
      interests: ["a", "b", "c", "d", "e", "f", "g"],
      listed: true,
    });
    expect(input.majors).toHaveLength(MAX_UW_MAJORS);
    expect(input.interests).toHaveLength(MAX_UW_INTERESTS);
  });

  it("writes the first exit always, and later ones only when they'd change something", () => {
    const yes = uwExitInput({ kind: "yes", majors: ["Economics"], interests: [], listed: true });
    expect(uwWriteNeeded(null, yes)).toBe(true);
    expect(uwWriteNeeded(null, { isUw: false })).toBe(true);
    // Back and on again, unchanged.
    expect(uwWriteNeeded(yes, { ...yes })).toBe(false);
    expect(uwWriteNeeded(yes, { ...yes, majors: ["economics"] })).toBe(false);
    expect(uwWriteNeeded(yes, { ...yes, majors: ["Economics", "Art"] })).toBe(true);
    expect(uwWriteNeeded(yes, { ...yes, listed: false })).toBe(true);
    expect(uwWriteNeeded(yes, { isUw: false })).toBe(true);
    expect(uwWriteNeeded({ isUw: false }, { isUw: false })).toBe(false);
  });

  it("starts a replayer in the cohort from what they have stored", () => {
    const stored = uwStoredInput({
      isUw: true,
      majors: ["economics"],
      interests: ["Chess"],
      listed: false,
    });
    expect(stored).toEqual({ isUw: true, majors: ["Economics"], interests: ["Chess"], listed: false });
    // Skip on the bar as it opened writes nothing, so a stale page can't
    // re-list or re-join someone who changed it elsewhere.
    const skip = uwExitInput({ kind: "yes", majors: ["Economics"], interests: ["Chess"], listed: false });
    expect(uwWriteNeeded(stored, skip)).toBe(false);
    expect(uwWriteNeeded(stored, { ...skip, listed: true })).toBe(true);
    expect(uwWriteNeeded(stored, { ...skip, interests: [] })).toBe(true);
    expect(uwWriteNeeded(stored, uwExitInput({ kind: "no" }))).toBe(true);
  });

  it("gives anyone outside the cohort no baseline, so No still writes", () => {
    expect(uwStoredInput(undefined)).toBeNull();
    expect(uwStoredInput(null)).toBeNull();
    expect(uwStoredInput({ isUw: false, majors: ["Art"], interests: [], listed: true })).toBeNull();
    expect(uwWriteNeeded(uwStoredInput(undefined), uwExitInput({ kind: "no" }))).toBe(true);
  });
});

describe("the CTA", () => {
  it("is none while the tiles are the way on, or one plays its selected state", () => {
    for (const uwPhase of ["choose", "selecting"] as const) {
      expect(uwPageCta({ uwPhase, hasUwInput: false })).toBeNull();
      expect(uwPageCta({ uwPhase, hasUwInput: true })).toBeNull();
    }
  });

  it("reads Skip for now on an empty quick-add, then Continue (R:88)", () => {
    expect(uwPageCta({ uwPhase: "open", hasUwInput: false })).toEqual({
      label: "Skip for now",
      variant: "secondary",
    });
    expect(uwPageCta({ uwPhase: "open", hasUwInput: true })).toEqual({
      label: "Continue",
      variant: "primary",
    });
  });

  it("counts chips and typed text alike as input", () => {
    expect(hasUwInput([], [], false)).toBe(false);
    expect(hasUwInput(["Economics"], [], false)).toBe(true);
    expect(hasUwInput([], ["Chess"], false)).toBe(true);
    expect(hasUwInput([], [], true)).toBe(true);
  });
});

// ---- Where it starts ---------------------------------------------------------

describe("where the sheet starts", () => {
  const member: SavedUw = {
    isUw: true,
    majors: ["economics", "Art"],
    interests: ["Chess"],
    listed: true,
  };

  it("reads the profile's columns failing closed, as Settings does", () => {
    expect(savedUwFrom(null)).toEqual({ isUw: false, majors: [], interests: [], listed: false });
    expect(savedUwFrom({})).toEqual({ isUw: false, majors: [], interests: [], listed: false });
    expect(
      savedUwFrom({ is_uw: true, uw_majors: ["Art"], uw_interests: null, uw_listed: null })
    ).toEqual({ isUw: true, majors: ["Art"], interests: [], listed: false });
  });

  it("has a member's sheet open on the bar, with their lists and listing as stored", () => {
    expect(uwStartState(member, true)).toEqual({
      uw: "yes",
      uwPhase: "open",
      majors: ["Economics", "Art"],
      interests: ["Chess"],
      uwListed: true,
    });
    expect(uwStartState({ ...member, listed: false }, true).uwListed).toBe(false);
  });

  it("gives everyone else, and everyone with UW off, the tiles", () => {
    const tiles = { uw: null, uwPhase: "choose", majors: [], interests: [], uwListed: false };
    expect(uwStartState(member, false)).toEqual(tiles);
    expect(uwStartState(undefined, true)).toEqual(tiles);
    expect(uwStartState({ ...member, isUw: false }, true)).toEqual(tiles);
  });

  it("a replayer's Continue goes straight to the UW page, and Skip keeps the listing as stored (P9c)", () => {
    const start = { ...initialWizardState(), ...uwStartState({ ...member, listed: false }, true) };
    expect(start).toMatchObject({ uwSheet: false, uwPage: false });
    const opened = continueWelcome(start);
    expect(opened).toMatchObject({
      uwSheet: false,
      uwPage: true,
      uw: "yes",
      uwPhase: "open",
      majors: ["Economics", "Art"],
    });
    expect(uwPageCta({ uwPhase: opened.uwPhase, hasUwInput: true })?.label).toBe("Continue");
    const exit = uwExitInput({
      kind: "yes",
      majors: opened.majors,
      interests: opened.interests,
      listed: opened.uwListed,
    });
    expect(uwProfilePayload(exit)?.uw_listed).toBe(false);
    // Exactly what they had, so Skip writes nothing.
    expect(uwWriteNeeded(uwStoredInput({ ...member, listed: false }), exit)).toBe(false);
    // Change, then Yes again beside the disclosure, lists them.
    const retapped = run(
      [{ type: "changeUw" }, { type: "pickUw", choice: "yes" }, { type: "openUw" }],
      opened
    );
    expect(retapped).toMatchObject({ uwPhase: "open", uwListed: true, majors: opened.majors });
  });
});

// ---- Geometry --------------------------------------------------------------------

describe("quickAddScrollTop", () => {
  const m = QUICK_ADD_REVEAL_PX;
  // A 300px quick-add with the field 200px down: everything fits in a tall
  // box, and a short one (the SE with its keyboard up) shows 60px.
  const at = (viewHeight: number, toEnd: boolean, scrollTop = 0) =>
    quickAddScrollTop({
      scrollTop,
      viewHeight,
      contentHeight: 300,
      fieldTop: 200,
      fieldBottom: 230,
      toEnd,
    });

  it("scrolls Interests to the bottom when the field still shows there (P:818)", () => {
    expect(at(200, true)).toBe(100);
    expect(at(400, true)).toBe(0);
  });

  it("stops short of the bottom when that would hide the field itself", () => {
    expect(at(60, true)).toBe(200 - m);
    // A field at the very top asks for nothing below zero.
    expect(
      quickAddScrollTop({
        scrollTop: 40,
        viewHeight: 60,
        contentHeight: 300,
        fieldTop: 4,
        fieldBottom: 34,
        toEnd: true,
      })
    ).toBe(0);
  });

  it("moves Major only as far as it takes to show it", () => {
    // Already in view: stays.
    expect(at(200, false, 50)).toBe(50);
    // Below the view: just enough to bring its bottom in.
    expect(at(100, false, 0)).toBe(230 + m - 100);
    // Above the view: its top, with room.
    expect(at(60, false, 250)).toBe(200 - m);
    // Taller than the view: its top wins.
    expect(at(20, false, 0)).toBe(200 - m);
  });
});

describe("the grab handle", () => {
  it("follows a finger down, and resists going up (bottom-sheet.tsx's gesture)", () => {
    expect(sheetDragOffset(0)).toBe(0);
    expect(sheetDragOffset(64)).toBe(64);
    expect(sheetDragOffset(-40)).toBe(-10);
    expect(sheetDragOffset(-400)).toBe(-SHEET_DRAG.upMaxPx);
    expect(sheetDragOffset(Number.NaN)).toBe(0);
  });

  it("puts the sheet away only past 90px down", () => {
    expect(sheetDragDismisses(90)).toBe(false);
    expect(sheetDragDismisses(91)).toBe(true);
    expect(sheetDragDismisses(-200)).toBe(false);
    expect(sheetDragDismisses(Number.NaN)).toBe(false);
  });
});

// ---- Styles -------------------------------------------------------------------

const view = (over: Partial<UwView> = {}): UwView => ({
  uw: null,
  uwPhase: "choose",
  reduced: false,
  ...over,
});

// Under reduced motion nothing travels (R:54).
function expectStill(style: { transform: string; transition: string }) {
  expect(style.transform).toBe("none");
  expect(style.transition).not.toContain("transform");
}

describe("uwTileStyle", () => {
  it("rests the two tiles as items 1 and 2, unselected, riding in with the sheet", () => {
    expect(uwTileStyle(view(), "yes")).toEqual({ ...itemStyle("active", 1, false), selected: false });
    expect(uwTileStyle(view(), "no")).toEqual({ ...itemStyle("active", 2, false), selected: false });
  });

  it("holds the tapped tile selected while the other fades and drops (R:77)", () => {
    const v = view({ uw: "yes", uwPhase: "selecting" });
    expect(uwTileStyle(v, "yes")).toEqual({
      opacity: 1,
      transform: "none",
      transition: "none",
      selected: true,
    });
    const other = uwTileStyle(v, "no");
    expect(other).toMatchObject({ opacity: 0, transform: "translateY(16px) scale(0.96)", selected: false });
    expect(other.transition).toContain("opacity 200ms ease-out");
    expect(other.transition).toContain("transform 320ms");
    expectStill(uwTileStyle({ ...v, reduced: true }, "no"));
  });

  it("hides the tiles the frame Yes opens, below, so Change brings them back up", () => {
    const open = view({ uw: "yes", uwPhase: "open" });
    expect(uwTileStyle(open, "yes")).toMatchObject({
      opacity: 0,
      transform: ITEM_ENTER.from,
      transition: "none",
      selected: true,
    });
    expect(uwTileStyle(open, "no").selected).toBe(false);
    // Change: back to the item rule's enter, from where they rest.
    expect(uwTileStyle(view({ uwPhase: "choose" }), "yes").transition).toBe(
      itemStyle("active", 1, false).transition
    );
  });

  it("crossfades the tiles out under reduced motion, as the bar fades in", () => {
    const reduced = uwTileStyle(view({ uw: "yes", uwPhase: "open", reduced: true }), "yes");
    expect(reduced.opacity).toBe(0);
    expect(reduced.transition).toBe("opacity 200ms linear 0ms");
    expectStill(reduced);
  });

  it("travels nowhere under reduced motion, in any state", () => {
    const states: Partial<UwView>[] = [
      {},
      { uw: "no", uwPhase: "selecting" },
      { uw: "yes", uwPhase: "selecting" },
      { uw: "yes", uwPhase: "open" },
    ];
    for (const s of states) {
      for (const which of ["yes", "no"] as const) {
        expectStill(uwTileStyle(view({ ...s, reduced: true }), which));
      }
    }
  });
});

describe("uwTilesInteractive", () => {
  it("takes taps only on the tiles of a sheet that's up", () => {
    const at = (uwSheet: boolean, uwPhase: UwPhase) => uwTilesInteractive({ uwSheet, uwPhase });
    expect(at(true, "choose")).toBe(true);
    expect(at(false, "choose")).toBe(false);
    expect(at(true, "selecting")).toBe(false);
    expect(at(true, "open")).toBe(false);
  });
});

describe("UW_PAGE_STAGGER", () => {
  it("staggers the page's items in order, the quick-add at R:83's offset 4", () => {
    const order = [
      UW_PAGE_STAGGER.label,
      UW_PAGE_STAGGER.title,
      UW_PAGE_STAGGER.bar,
      UW_PAGE_STAGGER.note,
      UW_PAGE_STAGGER.quickAdd,
    ];
    expect(order).toEqual([0, 1, 2, 3, 4]);
    // The quick-add's eyebrow enters 140 + 4 × 55 = 360ms after the page does.
    expect(itemStyle("active", UW_PAGE_STAGGER.quickAdd, false).transition).toContain(
      `${ITEM_ENTER.delayMs + UW_PAGE_STAGGER.quickAdd * ITEM_ENTER.staggerMs}ms`
    );
  });
});
