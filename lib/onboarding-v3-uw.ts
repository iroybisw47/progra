// Onboarding v3's UW question (.claude/plans/onboarding-v3.md P9c, D2, D3,
// D11, OWNER-FIX-3): "Are you a UW student?" and its two tiles, the Yes
// tile's morph into the bar, and the optional majors and interests quick-add
// under it. Behind UW. Since OWNER-FIX-3 it's a bottom sheet that the welcome
// screen's Continue opens over itself once the identity is saved; with UW off
// none of this renders and that Continue goes straight to Screen 2 (D11).
//
// Pure, like lib/onboarding-v3-identity.ts beside it. The answer itself
// (uw, uwPhase, the lists, uwListed) and whether the sheet is up (uwSheet) are
// lib/onboarding-v3.ts's wizardReducer. This file holds every decision around
// them that can be wrong without a device: whether a tile tap counts, whether
// the sheet may be dismissed, what its CTA is, what each exit saves, where a
// replayer starts, how a drag and a resize move it, and the styles the
// prototype's renderVals gives the tiles and the quick-add in each state
// (P:1342-1357). The sheet owns the timers, the refs and the network.
//
// "R:<line>" and "P:<line>" cite the design handoff, as the plan does.

import { SCREEN, type UwChoice, type UwPhase, type WizardState } from "@/lib/onboarding-v3";
import {
  EASING,
  ITEM_ENTER,
  SHEET,
  itemStyle,
  transition,
  type ItemStyle,
  type Tween,
} from "@/lib/motion";
import {
  cleanInterests,
  cleanMajors,
  isUwProfileChange,
  type UwProfileInput,
} from "@/lib/uw";
import { UW_LISTED_DISCLOSURE, type SavedUw } from "@/lib/uw-fields";

// ---- Copy -------------------------------------------------------------------

// R:75-88, word for word, plus plan D2's disclosure on the Yes bar. The
// question is the sheet's title, on one line (R:75 broke it after "a" for
// Screen 1's 32px column, which the sheet no longer has).
export const UW_COPY = {
  question: "Are you a UW student?",
  yes: { label: "Yes", sub: "Find UW friends" },
  no: { label: "No", sub: "Bring your own crew" },
  bar: "UW student",
  change: "Change",
  eyebrow: "Optional: helps us suggest UW friends",
  // Under the tiles for someone already in the cohort: what No does.
  leaving: "Choosing No takes you out of UW groups and clears your majors and interests.",
} as const;

// The line under the Yes bar: D2's disclosure, in the Settings switch's own
// words (lib/uw-fields.ts), whenever the Yes path will save this student as
// listed. The one student who sees the bar without being listed is a replayer
// already in the cohort whose listing is off (the column's default, which
// every member from before STEP 5 has, or switched off in Settings) and who
// hasn't tapped Yes again this run (uwListed). They get no line: the
// disclosure would describe an exposure that isn't happening, and the plan
// approves no other copy here.
export function uwBarNote(listed: boolean): string | null {
  return listed ? UW_LISTED_DISCLOSURE : null;
}

// The line under the tiles, for someone the profile has in the cohort (the
// shell's inCohort, uw-writes.ts): No takes them out and clears their majors
// and interests (uwProfilePayload), which Settings says in as many words
// beside its own switch (UW_LEAVING_NOTE). It's there before the tap, since
// No saves and moves on by itself. Nobody else has anything for No to clear.
export function uwTilesNote(inCohort: boolean): string | null {
  return inCohort ? UW_COPY.leaving : null;
}

// ---- Timing (P:791-815) -----------------------------------------------------

// R gives the normal timings. Under reduced motion the prototype shortens
// each (rm ? … : …), since nothing travels to wait for.
export const UW_TIMING = {
  // No: the selected tile holds this long, then the sheet goes and Screen 2
  // comes (R:79).
  noAdvanceMs: { normal: 780, reduced: 450 },
  // Yes: the selected tile holds this long, then morphs into the bar (R:80).
  yesOpenMs: { normal: 320, reduced: 160 },
  // The major field takes the focus this long after the bar opens (R:80).
  majorFocusMs: { normal: 480, reduced: 120 },
} as const;

export type UwTimer = keyof typeof UW_TIMING;

export function uwDelay(name: UwTimer, reduced: boolean): number {
  const t = UW_TIMING[name];
  return reduced ? t.reduced : t.normal;
}

// Focusing Interests scrolls the sheet to its bottom after this long (P:818),
// once the field has the focus.
export const INTERESTS_SCROLL_MS = 80;

// Room kept around a focused input as the sheet scrolls to it: the chip
// box's 7.5px of padding and border, and a little air.
export const QUICK_ADD_REVEAL_PX = 12;

// Where the sheet's content scrolls with a field focused, in its scroll box's
// content coordinates (`fieldTop`/`fieldBottom` are the input's). Interests
// asks for the bottom (`toEnd`, R:87), so its suggestions and the D3 line
// show, and Major for the nearest place that shows it. Either way never so
// far that the input itself leaves the view, which the bottom would on a
// short phone with the keyboard up (an SE leaves the sheet 50-100px).
export function quickAddScrollTop({
  scrollTop,
  viewHeight,
  contentHeight,
  fieldTop,
  fieldBottom,
  toEnd,
}: {
  scrollTop: number;
  viewHeight: number;
  contentHeight: number;
  fieldTop: number;
  fieldBottom: number;
  toEnd: boolean;
}): number {
  const max = Math.max(0, contentHeight - viewHeight);
  const clamp = (n: number) => Math.min(Math.max(n, 0), max);
  const top = fieldTop - QUICK_ADD_REVEAL_PX;
  if (toEnd) return clamp(Math.min(max, top));
  if (top < scrollTop) return clamp(top);
  const bottom = fieldBottom + QUICK_ADD_REVEAL_PX - viewHeight;
  if (bottom > scrollTop) return clamp(Math.min(top, bottom));
  return clamp(scrollTop);
}

// ---- The sheet ----------------------------------------------------------------

// Whether a tap on the sheet counts, a tile's or the dimmed welcome's: only
// once it has finished rising (`armedAt`, null until then), and for a
// pointer's click only when the press itself began after that. The sheet
// rises over where the welcome's Continue was, so the second tap of a double
// tap on Continue (likely while a slow save keeps it busy) would otherwise
// answer the question, or put the sheet away, unseen. A keyboard's click has
// no press (`detail` 0).
export function sheetTapCounts(armedAt: number | null, pressedAt: number, detail: number): boolean {
  return armedAt !== null && (detail === 0 || pressedAt >= armedAt);
}

// When the sheet arms: as its rise ends (lib/motion.ts SHEET.in).
export function sheetArmMs(reduced: boolean): number {
  const tweens = reduced ? SHEET.in.reduced : SHEET.in.normal;
  return Math.max(0, ...tweens.map((t) => t.duration + t.delay));
}

// What a tap on a tile does (P:791-802): it takes the answer only from the
// tiles of a sheet that's up over Screen 1 with no save in flight. Anything
// else (a tile still playing its selected state, Yes already open, a No
// write under way) is ignored. There is no "fix the identity first" any more:
// the sheet only opens once the welcome has saved it.
export type UwTileTap = "select" | "ignore";

export function uwTileTap({
  screen,
  uwSheet,
  uwPhase,
  busy,
}: {
  screen: number;
  uwSheet: boolean;
  uwPhase: UwPhase;
  busy: boolean;
}): UwTileTap {
  return screen === SCREEN.identity && uwSheet && uwPhase === "choose" && !busy
    ? "select"
    : "ignore";
}

// Whether the sheet may go down unanswered (a tap on the dimmed welcome, a
// drag down, Escape): it's up, no tile is playing its selected state (No is
// saving on its way to Screen 2, Yes is about to open), and no save is in
// flight. It closes onto the welcome screen, which stays put, and the next
// Continue opens it as it was left.
export function uwSheetDismissible({
  uwSheet,
  uwPhase,
  busy,
}: {
  uwSheet: boolean;
  uwPhase: UwPhase;
  busy: boolean;
}): boolean {
  return uwSheet && uwPhase !== "selecting" && !busy;
}

// The UW page's CTA, the wizard's own (R:88): none while the tiles are the
// way on (or one is playing its selected state), then, with Yes open, "Skip
// for now" until a major or interest is chosen or typed, and the primary
// "Continue" after, which commits what's typed. Either saves the Yes path and
// goes on to Screen 2.
export type UwPageCta =
  | { label: "Skip for now"; variant: "secondary" }
  | { label: "Continue"; variant: "primary" }
  | null;

export function uwPageCta({
  uwPhase,
  hasUwInput,
}: {
  uwPhase: UwPhase;
  hasUwInput: boolean;
}): UwPageCta {
  if (uwPhase !== "open") return null;
  return hasUwInput
    ? { label: "Continue", variant: "primary" }
    : { label: "Skip for now", variant: "secondary" };
}

// Whether the quick-add holds anything, which turns its CTA from "Skip for
// now" into "Continue" (R:88). Typed text counts, as in the prototype
// (P:1352), since Continue commits it.
export function hasUwInput(
  majors: readonly string[],
  interests: readonly string[],
  hasDraft: boolean
): boolean {
  return majors.length > 0 || interests.length > 0 || hasDraft;
}

// The grab handle, as components/v2/bottom-sheet.tsx has it: the sheet
// follows a finger down, and resists going up (a quarter of the way, at most
// 40px), so it feels held at the top of its travel. Let go past 90px down and
// it's dismissed; short of that it settles back.
export const SHEET_DRAG = { dismissPx: 90, upDamping: 0.25, upMaxPx: 40 } as const;

export function sheetDragOffset(dy: number): number {
  if (!Number.isFinite(dy)) return 0;
  return dy > 0 ? dy : Math.max(dy * SHEET_DRAG.upDamping, -SHEET_DRAG.upMaxPx);
}

export function sheetDragDismisses(dy: number): boolean {
  return Number.isFinite(dy) && dy > SHEET_DRAG.dismissPx;
}

// ---- Persistence ------------------------------------------------------------

// What each way out of the sheet saves through setUwProfile (P9a's
// uwProfilePayload turns it into the row update):
//   No                  { isUw: false }: leaving clears every UW field and
//                       unlists, so a replayer who was UW leaves the cohort.
//   Yes, Skip/Continue  { isUw: true } with the committed majors and
//                       interests, and the listing as uwListed has it, which
//                       is true on a Yes tapped in the sheet (the reducer's
//                       pickUw) and a replayer's stored value until they tap
//                       Yes again.
// The lists are cleaned here as the action will clean them, so the sheet can
// compare what it means to save with what it last saved (uwWriteNeeded). A
// dismissal saves nothing.
export type UwExit =
  | { kind: "no" }
  | { kind: "yes"; majors: readonly string[]; interests: readonly string[]; listed: boolean };

export function uwExitInput(exit: UwExit): UwProfileInput {
  if (exit.kind === "no") return { isUw: false };
  return {
    isUw: true,
    majors: cleanMajors(exit.majors),
    interests: cleanInterests(exit.interests),
    listed: exit.listed === true,
  };
}

// Whether an exit has to write: when there's nothing to compare it with (a
// first run, or a replayer not in the cohort), so the answer is stored, and
// otherwise only when it would store something other than the baseline:
// what the profile held when the page loaded (uwStoredInput), then this run's
// last save. Back to the welcome and on again, unchanged, writes nothing
// twice (as identityWrites and the goal diff do).
export function uwWriteNeeded(lastWritten: UwProfileInput | null, next: UwProfileInput): boolean {
  return lastWritten === null || isUwProfileChange(lastWritten, next);
}

// The baseline a replayer already in the cohort starts from: their stored
// answer, as the input that would store it, the way the welcome starts from
// the saved name and handle. So a replay that leaves the Yes path as it found
// it writes nothing, and can't re-assert membership or the listing from this
// page's snapshot after the student left or unlisted on another device
// (isUwProfileChange in lib/uw.ts says the same of Settings). Anyone not in
// the cohort has none, so their first exit writes, No included.
export function uwStoredInput(saved: SavedUw | null | undefined): UwProfileInput | null {
  if (saved?.isUw !== true) return null;
  return uwExitInput({
    kind: "yes",
    majors: saved.majors,
    interests: saved.interests,
    listed: saved.listed === true,
  });
}

// ---- Where the sheet starts -------------------------------------------------

// The profile's UW columns as the pages read them, failing closed the way the
// Settings page does (app/settings/page.tsx): an absent key, before STEP 5 or
// with UW off, reads as not in the cohort, no lists, not listed.
export function savedUwFrom(
  profile: {
    is_uw?: boolean | null;
    uw_majors?: string[] | null;
    uw_interests?: string[] | null;
    uw_listed?: boolean | null;
  } | null
): SavedUw {
  return {
    isUw: profile?.is_uw === true,
    majors: profile?.uw_majors ?? [],
    interests: profile?.uw_interests ?? [],
    listed: profile?.uw_listed === true,
  };
}

export type UwStart = Pick<WizardState, "uw" | "uwPhase" | "majors" | "interests" | "uwListed">;

// The UW half of the wizard's first state. Someone already in the cohort (a
// replayer, or a first run reloaded after the sheet saved Yes) has the sheet
// open on the Yes bar when the welcome's Continue raises it, with their
// majors and interests in the chip fields and their listing as stored (P9c's
// rule). Everyone else, and everyone while UW is off, gets the tiles with
// nothing chosen. The lists go through the action's cleaners so the chips
// show what a save would store. The sheet itself always starts down.
export function uwStartState(saved: SavedUw | null | undefined, uwEnabled: boolean): UwStart {
  if (!uwEnabled || saved?.isUw !== true) {
    return { uw: null, uwPhase: "choose", majors: [], interests: [], uwListed: false };
  }
  return {
    uw: "yes",
    uwPhase: "open",
    majors: cleanMajors(saved.majors),
    interests: cleanInterests(saved.interests),
    uwListed: saved.listed === true,
  };
}

// ---- Layout -----------------------------------------------------------------

const opacity = (duration: number, easing: string, delay = 0): Tween => ({
  property: "opacity",
  duration,
  easing,
  delay,
});
const move = (duration: number, easing: string, delay = 0): Tween => ({
  property: "transform",
  duration,
  easing,
  delay,
});

// The state the sheet's tiles and quick-add draw from.
export type UwView = {
  uw: UwChoice | null;
  uwPhase: UwPhase;
  reduced: boolean;
};

// One tile's style and whether it shows selected (P:1342-1350).
export type UwTileStyle = ItemStyle & { selected: boolean };

export function uwTileStyle(v: UwView, which: UwChoice): UwTileStyle {
  const chosen = v.uw === which;
  if (v.uwPhase === "selecting") {
    // The tapped tile holds still in its selected state (its bounce is a
    // one-shot). The other fades and drops away.
    if (chosen) return { opacity: 1, transform: "none", transition: "none", selected: true };
    return {
      opacity: 0,
      transform: v.reduced ? "none" : "translateY(16px) scale(0.96)",
      transition: transition(
        v.reduced
          ? [opacity(160, "linear")]
          : [opacity(200, "ease-out"), move(320, EASING.E)]
      ),
      selected: false,
    };
  }
  if (v.uwPhase === "open") {
    // Gone the frame the bar takes over: the FLIP starts the bar where the
    // Yes tile was, so the two never show at once. They rest where the item
    // motion brings them back from, for Change. Under reduced motion there
    // is no FLIP, and the bar crossfades in (lib/motion.ts flip()), so the
    // tiles fade out across the same 200ms instead (R:54), the Yes one still
    // selected.
    return {
      opacity: 0,
      transform: v.reduced ? "none" : ITEM_ENTER.from,
      transition: v.reduced ? transition([opacity(200, "linear")]) : "none",
      selected: chosen,
    };
  }
  // The tiles, up: the item motion (Yes 1, No 2), so coming back from the bar
  // (Change) or after a failed No they rise in as items do. In the sheet they
  // rest here, so the sheet's own rise carries them in when it opens.
  return { ...itemStyle("active", which === "yes" ? 1 : 2, v.reduced), selected: false };
}

// Whether the tiles take taps and focus: the sheet is up and on its tiles.
// During a tile's selected state they stay in place, out of reach of a second
// answer (uwTileTap ignores it too).
export function uwTilesInteractive(v: { uwSheet: boolean; uwPhase: UwPhase }): boolean {
  return v.uwSheet && v.uwPhase === "choose";
}

// Stagger indexes on the UW page (OWNER-FIX-4), its items in order as every
// screen staggers them: the label 0 and the question 1, as Screens 2 and 3
// have theirs; the bar's own slot 2 (it takes part in the stagger only when it
// didn't morph from the Yes tile, P:1389); the note under it 3; and the
// quick-add's eyebrow, Major and Interests from 4 (R:83's "offset 4").
export const UW_PAGE_STAGGER = { label: 0, title: 1, bar: 2, note: 3, quickAdd: 4 } as const;
