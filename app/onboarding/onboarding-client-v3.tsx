"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";

import { useFriendAdds } from "@/components/v2/person-row";
import { PillToast, type PillToastHandle } from "@/components/v2/pill-toast";
import {
  NO_RELATIONS,
  addsFromOutgoing,
  type AddPerson,
  type FriendRelations,
} from "@/lib/find-friends";
import { clockHandoffHref } from "@/lib/clock-handoff";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { handoffExitMs, type Box, type ItemPhase } from "@/lib/motion";
import { markNavRise, sessionFlagStore } from "@/lib/nav-rise";
import { V3_STEPS } from "@/lib/onboarding";
import {
  INTRO_BEATS,
  SCREEN,
  SCREEN_COUNT,
  formatGoalTitle,
  friendsCta,
  initialWizardState,
  wizardReducer,
  type UwChoice,
  type WizardAction,
  type WizardState,
} from "@/lib/onboarding-v3";
import {
  goalColors,
  newGoalHours,
  prefillWizard,
  readyGoal,
  type AccountGoal,
  type AccountHabit,
} from "@/lib/onboarding-v3-goals-habits";
import {
  phaseFor,
  welcomeContinue,
  welcomeHandle,
  welcomeShown,
} from "@/lib/onboarding-v3-identity";
import { introCtaLabel, type WeekSeg } from "@/lib/onboarding-v3-intro";
import type { OnboardingV3Services } from "@/lib/onboarding-v3-services";
import {
  hasUwInput,
  uwDelay,
  uwExitInput,
  uwPageCta,
  uwSheetDismissible,
  uwStartState,
  uwStoredInput,
  uwTileTap,
} from "@/lib/onboarding-v3-uw";
import type { SavedUw } from "@/lib/uw-fields";
import { cn } from "@/lib/utils";

import { FindFriendsScreen } from "./v3/find-friends-screen";
import {
  GoalScreen,
  useGoalWrites,
  type GoalHoursEdit,
  type GoalScreenHandle,
} from "./v3/goal-screen";
import { HabitsScreen, useHabitWrites, type HabitsScreenHandle } from "./v3/habits-screen";
import { IntroScreen } from "./v3/intro-screen";
import {
  KeyboardInsetVar,
  OnboardingCta,
  type CtaSpec,
  type OnboardingCtaHandle,
} from "./v3/onboarding-cta";
import { ReadyScreen } from "./v3/ready-screen";
import { REAL_SERVICES } from "./v3/services";
import { UwScreen, type UwScreenHandle } from "./v3/uw-screen";
import { useUwWrites } from "./v3/uw-writes";
import { V3_COLUMN, V3_FRAME } from "./v3/frame";
import { WelcomeScreen, useWelcomePhoto, type WelcomeScreenHandle } from "./v3/welcome-screen";
import { WizardChrome } from "./v3/wizard-chrome";

// The UW sheet is a dialog, so it loads as its own chunk (AGENTS.md): only
// with UW on, requested as the wizard mounts, well before a Continue can
// raise it. Client-only, since it shows nothing until then.
const UwSheet = dynamic(() => import("./v3/uw-sheet").then((m) => m.UwSheet), { ssr: false });

// Onboarding v3 (.claude/plans/onboarding-v3.md): six screens that replace
// v2's nine steps, behind ONBOARDING_V3. Rendered at `/` for a first run and
// at `/onboarding` for Replay.
//
// This is the shell (P3): the top row, the one CTA and the six screen layers,
// Screens 1-6 (the welcome, goals, habits, the intro, find friends, ready).
// The wizard never finishes itself: Screen 6 hands off to the normal Clock
// tab with the first goal preselected (OWNER-FIX-1, lib/clock-handoff.ts),
// and a leaf there stamps onboarded_at on arrival
// (app/clock/finish-onboarding.tsx says why there).
//
// Screen 1 is v2's welcome screen, the one live today (OWNER-FIX-3): its
// name, handle and photo, under the rainbow app icon, with no top row. Its
// Continue saves the identity, then raises the UW question as a bottom sheet
// over it (UW on) or goes to Screen 2 (off). The top row and its 28px avatar
// fade in from Screen 2.
//
// Every screen stays MOUNTED, with the ones not in front `inert` and
// aria-hidden. That replaces v2's `key={step}` remount, and it's what lets
// the elements of a screen being left exit (up when going forward, down when
// going back) while the next one's enter, on the shared item motion
// (lib/motion.ts itemStyle). It also means Back finds every field as it was
// left.
//
// Navigation is lib/onboarding-v3.ts's wizardReducer, which holds the rules
// that are easy to get wrong (Screen 1 has no Back; any move closes the UW
// sheet; Back to Screen 1 after "No" asks again; entering Screen 4 resets its
// beat). Screen 4's beat lives there too, because the CTA here pages it. So
// do the goal and habit writes, which the CTA triggers, Screen 5's added
// people, which the CTA counts, and the welcome's photo and its saved name
// and handle, which the top row and the intro show. Each screen's typing
// stays in the screen, the welcome's included (welcome-screen.tsx), so a
// keystroke doesn't re-render the other five.
//
// With UW on (P9c), the sheet asks "Are you a UW student?". No saves
// { isUw: false } while its tile holds, then the sheet goes and Screen 2
// comes. Yes holds, then the sheet goes and the UW page comes, a full page
// on Screen 1 (OWNER-FIX-4, v3/uw-screen.tsx): the tile morphs into its bar,
// over the optional majors and interests, and the CTA's Skip or Continue
// saves the Yes path and moves on. Back from the page is the welcome, Back
// from Screen 2 the page, and while the answer is Yes the welcome's Continue
// goes straight to the page. Put away unanswered (the dimmed welcome, a drag
// down, Escape), the sheet leaves the welcome as it was, and the next
// Continue raises it as it was left. A failed write
// toasts and keeps the sheet up (lib/onboarding-v3-uw.ts), except a No from
// someone with nothing to take out of the cohort (chooseNo). A Yes then gives
// Screen 5 the student's UW groups in place of the invite preview (P9d),
// which it fetches as it comes into view.
//
// Reduced motion: the root carries data-onboarding-v3, which globals.css uses
// to still every CSS keyframe loop inside it. Transitions and WAAPI one-shots
// pick their reduced specs from lib/motion.ts.
//
// Everything that leaves the browser goes through `services` (the real
// actions unless the dev preview passes fakes; lib/onboarding-v3-services.ts),
// the welcome's photo included.
type Props = {
  initialUsername: string;
  initialDisplayName: string | null;
  avatarUrl: string | null;
  // onboarded_at is already set: Settings → Replay. Starts with the saved
  // name and handle, and gets the quiet close control (D6).
  replay: boolean;
  // The active goals and habits the account already has, which Screens 2 and
  // 3 start from and diff against (lib/onboarding-v3-goals-habits.ts). Empty
  // for a fresh account, and not for a replayer or a first run reloaded after
  // Screen 2 saved, which is why they're read rather than assumed.
  existingGoals: AccountGoal[];
  existingHabits: AccountHabit[];
  // This week's time by category, for Screen 4's Beat 2 (plan D15). Only
  // /onboarding reads it, since only a replayer can have tracked time. None,
  // or a week with nothing in it, draws the sample week instead.
  weekSegments?: WeekSeg[];
  // Who the viewer is already friends with, has asked, or has been asked by
  // (getFriendRelations), so Screen 5's results offer "Friends", Accept or
  // "✓ Added" instead of an Add that can only fail, and a reload keeps the
  // requests already sent as added (and undoable). None is a fresh account.
  relations?: FriendRelations;
  // NEXT_PUBLIC_UW (P9c): the welcome's Continue raises the UW sheet. Off,
  // it goes straight to Screen 2 (D11). The dev preview can force it either
  // way.
  uw?: boolean;
  // The profile's UW columns, read only with UW on (savedUwFrom). Someone
  // already in the cohort goes from the welcome straight to the UW page,
  // with their majors, interests and listing as stored (uwStartState).
  savedUw?: SavedUw;
  // Dev preview only (app/dev/onboarding-v3). Production passes none of these.
  // The UW sheet starts up over the welcome (UW on)...
  initialUwSheet?: boolean;
  // ...with this tile already selected, held there.
  initialUwSelected?: UwChoice;
  // The UW page in front on Screen 1, with Yes answered (OWNER-FIX-4).
  initialUwPage?: boolean;
  services?: OnboardingV3Services;
  initialScreen?: number;
  initialBeat?: number; // Screen 4 opens on this beat (0-based)
  usernameDraft?: string; // the welcome's username opens with this typed
  goalDraft?: string; // Screen 2's field opens with this typed
  habitDraft?: string; // Screen 3's "Your own" opens with this typed
  searchDraft?: string; // Screen 5's search opens with this typed
  // Called with the Clock tab's address in place of the navigation Screen
  // 6's "Start session" ends in, once its exit has played: the preview
  // starts over rather than open the real Clock, which needs an account.
  onHandoff?: (href: string) => void;
};

// Each screen's section label, for assistive tech, by screen index.
const SCREEN_LABELS = [
  "Welcome",
  "Your goal",
  "Your habits",
  "What Progra is",
  "Find your friends",
  "Start your first session",
];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The wizard as it opens: on `screen`, with Screens 2 and 3 showing what the
// account already has, and the UW sheet's answer what the profile holds (UW
// on). `beat` only counts when it opens on Screen 4, which only the dev
// preview does; otherwise the intro starts at beat 1, as it does whenever
// it's entered. So do `sheet` and `selected`, the preview's sheet already up
// over the welcome and its held tile, and `page`, the UW page in front.
function startAt({
  screen,
  beat,
  goals,
  habits,
  uw,
  savedUw,
  sheet,
  selected,
  page,
}: {
  screen: number;
  beat: number;
  goals: AccountGoal[];
  habits: AccountHabit[];
  uw: boolean;
  savedUw: SavedUw | undefined;
  sheet: boolean;
  selected: UwChoice | undefined;
  page: boolean;
}): WizardState {
  const at = Number.isInteger(screen) ? Math.min(Math.max(screen, 0), SCREEN_COUNT - 1) : 0;
  const prefilled: WizardState = {
    ...initialWizardState(),
    ...prefillWizard(goals, habits),
    ...uwStartState(savedUw, uw),
    screen: at,
  };
  const up = uw && sheet && at === SCREEN.identity;
  // The page shows a Yes: the profile's own, or one just tapped (listing).
  const onPage: WizardState = {
    ...prefilled,
    uw: "yes",
    uwPhase: "open",
    uwListed: prefilled.uw === "yes" ? prefilled.uwListed : true,
    uwPage: true,
  };
  const start: WizardState =
    uw && page && at === SCREEN.identity
      ? onPage
      : !up
        ? prefilled
        : selected
          ? { ...prefilled, uwSheet: true, uw: selected, uwPhase: "selecting" }
          : { ...prefilled, uwSheet: true };
  if (at !== SCREEN.intro || !Number.isInteger(beat)) return start;
  return { ...start, beat: Math.min(Math.max(beat, 0), INTRO_BEATS - 1) };
}

// Close the keyboard when a screen is left, so the field going out of view
// (and, a moment later, inert) doesn't keep it up.
function blurField() {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur();
}

// Whether focus has nowhere real to be: on the page itself (a blurred field,
// or a button disabled under it), or on something now inert or hidden, such as
// Back as Screen 1 hides it, or the UW sheet as it goes.
function focusLost(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return true;
  return el.matches(":disabled") || el.closest("[inert], [aria-hidden='true']") !== null;
}

// Focus a screen's section itself, so assistive tech announces it by its
// label and Tab continues from inside it. Focusable only while focused: a
// standing tabindex would let a tap on empty space take focus from a field and
// drop the keyboard.
function focusSection(section: HTMLElement | null | undefined) {
  if (!section) return;
  section.setAttribute("tabindex", "-1");
  section.addEventListener("blur", () => section.removeAttribute("tabindex"), { once: true });
  section.focus({ preventScroll: true });
}

export function OnboardingClientV3({
  initialUsername,
  initialDisplayName,
  avatarUrl,
  replay,
  existingGoals,
  existingHabits,
  weekSegments,
  relations = NO_RELATIONS,
  uw = false,
  savedUw,
  initialUwSheet = false,
  initialUwSelected,
  initialUwPage = false,
  services = REAL_SERVICES,
  initialScreen = SCREEN.identity,
  initialBeat = 0,
  usernameDraft,
  goalDraft,
  habitDraft,
  searchDraft,
  onHandoff,
}: Props) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const [wizard, dispatch] = useReducer(
    wizardReducer,
    {
      screen: initialScreen,
      beat: initialBeat,
      goals: existingGoals,
      habits: existingHabits,
      uw,
      savedUw,
      sheet: initialUwSheet,
      selected: initialUwSelected,
      page: initialUwPage,
    },
    startAt
  );
  const screen = wizard.screen;
  // The UW sheet is up over the welcome. The reducer only ever has it up on
  // Screen 1; UW off, it never renders.
  const sheetUp = uw && wizard.uwSheet && screen === SCREEN.identity;
  // The UW page is in front, on Screen 1 (OWNER-FIX-4), and what's in front
  // as the focus and the sections know it: a screen's index, or "uw".
  const uwPageShown = uw && wizard.uwPage && screen === SCREEN.identity;
  const view = uwPageShown ? "uw" : String(screen);

  const columnRef = useRef<HTMLDivElement>(null);
  // Success toasts for the screens that have them (Screen 5's "Invite
  // shared", P6). Errors go through sonner.
  const toastRef = useRef<PillToastHandle>(null);
  const ctaRef = useRef<OnboardingCtaHandle>(null);

  // The welcome (Screen 1, OWNER-FIX-3). Its fields live in the screen
  // (welcome-screen.tsx says why), which tells the shell only whether the
  // handle lets Continue through and whether a save is in flight. The top
  // row and the intro show the name and handle as Continue last saved them.
  const welcomeRef = useRef<WelcomeScreenHandle>(null);
  const [welcomeValid, setWelcomeValid] = useState(
    () => welcomeHandle(usernameDraft ?? initialUsername).valid
  );
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [shown, setShown] = useState(() => welcomeShown(initialDisplayName, initialUsername));
  const photo = useWelcomePhoto(avatarUrl, services);
  // The UW sheet's answer, written on each way on from it that changes
  // what's stored. A replayer in the cohort starts from what they have.
  const uwWrites = useUwWrites(services, uw ? uwStoredInput(savedUw) : null);
  // The UW page (OWNER-FIX-4): its CTA, through its ref; whether anything is
  // typed there, for the CTA's label; and the Yes tile's box on screen, for
  // its bar to morph from, from the tap until the page is left.
  const uwScreenRef = useRef<UwScreenHandle>(null);
  const [uwHasDraft, setUwHasDraft] = useState(false);
  const [uwMorph, setUwMorph] = useState<Box | null>(null);
  const goalWrites = useGoalWrites({ services, account: existingGoals });
  const habitWrites = useHabitWrites({ services, account: existingHabits });
  // Screen 5's added people: a request sent on each Add (D13), taken back on
  // "✓ Added". Here so they survive Back and forward, and the CTA counts them.
  // Requests already out when the page rendered start added.
  const friendAdds = useFriendAdds({
    send: services.sendFriendRequest,
    remove: services.cancelFriendRequest,
    initial: addsFromOutgoing(relations.outgoing),
    onSent: (userId) => services.track("friend_request_sent", { target_id: userId }),
  });
  const goalScreenRef = useRef<GoalScreenHandle>(null);
  const habitsScreenRef = useRef<HabitsScreenHandle>(null);
  // Whether Screen 2's field holds anything. The draft itself stays in the
  // screen (goal-screen.tsx says why); the CTA only needs to know this.
  const [goalHasDraft, setGoalHasDraft] = useState(() => (goalDraft ?? "").trim().length > 0);
  // Screen 6's handoff has begun: its items exit, the top row fades, and
  // nothing on the wizard answers a tap. The CTA stays put until the Clock
  // tab replaces the wizard.
  const [leaving, setLeaving] = useState(false);

  // A screen change mustn't strand focus: leaving blurs the field (Return in
  // the handle field included), and Back disables and hides itself on the
  // welcome. If focus ended up nowhere, it goes to the incoming screen, which
  // also announces it. Focus on the CTA stays there, for a keyboard user
  // pressing Continue through the screens. The UW page counts as a screen
  // here: arriving from the sheet, focus was in the sheet as it went.
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    if (!focusLost()) return;
    focusSection(columnRef.current?.querySelector<HTMLElement>(`[data-screen="${view}"]`));
  }, [view]);

  // The sheet put away onto the welcome: focus goes back to the Continue that
  // raised it, if it was left inside the sheet. (Going on to Screen 2, or to
  // the UW page, instead is the change of view above.)
  const sheetWasUp = useRef(sheetUp);
  useEffect(() => {
    const was = sheetWasUp.current;
    sheetWasUp.current = sheetUp;
    if (!was || sheetUp || view !== String(SCREEN.identity) || !focusLost()) return;
    columnRef.current
      ?.querySelector<HTMLElement>("[data-onboarding-cta] button:not([tabindex='-1'])")
      ?.focus({ preventScroll: true });
  }, [sheetUp, view]);

  // Analytics: the screen just entered, by V3_STEPS name and with flow "v3"
  // (lib/telemetry/events.ts says why both). Re-fires on Back, a real
  // re-entry. setOnboardingStep is the per-user "where did they stop".
  useEffect(() => {
    const step = V3_STEPS[screen];
    services.track("onboarding_step_viewed", { step_name: step, flow: "v3" });
    services.recordStep(step);
  }, [screen, services]);

  // The screen in front now, for a save that settles after Back was pressed:
  // it must not then carry the wizard forward from wherever Back took it.
  const screenNow = useRef(screen);
  useEffect(() => {
    screenNow.current = screen;
  }, [screen]);
  // Every screen change, Back included, counted for advanceLater.
  const moves = useRef(0);
  // The same for the UW answer: a Yes path save that settles after Change
  // took the answer back, or the page was left, mustn't carry the wizard on.
  const uwNow = useRef({ phase: wizard.uwPhase, page: uwPageShown });
  useEffect(() => {
    uwNow.current = { phase: wizard.uwPhase, page: uwPageShown };
  }, [wizard.uwPhase, uwPageShown]);

  // The navigation the handoff ends in, unless the wizard unmounted first.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Screen 6's goal: the first one Screen 2 listed, on the row its save left
  // it on (readyGoal). The pill names it, and the Clock tab opens with it
  // preselected (OWNER-FIX-1).
  const firstGoal = readyGoal(
    goalWrites.rows,
    wizard.goals,
    wizard.goalHours,
    wizard.goalRowIds
  );
  const clockHref = clockHandoffHref(firstGoal?.id);

  // "Start session" (R:152): no zoom or morph. Screen 6's items exit on the
  // item motion while the top row fades, and the BottomNav is asked to rise
  // when it next appears (lib/nav-rise.ts). Then the Clock tab, already
  // prefetched, replaces the wizard. The push waits out the exit
  // (handoffExitMs), which is all it waits for: Screen 6 writes nothing, so
  // there's nothing to settle first. A tap in the first moments can still
  // beat the prefetch, and the Clock then arrives through its loading
  // skeleton: a known path, on the device checks, and better than a tap that
  // does nothing.
  //
  // The Clock tab stamps a first run's onboarded_at, and counts its
  // completion when that lands (app/clock/finish-onboarding.tsx). A replayer
  // has nothing to stamp, so their completion is counted here, as v2 counted
  // every finish.
  function startSession() {
    if (leaving) return;
    blurField();
    services.track("onboarding_step_completed", { step_name: V3_STEPS[SCREEN.ready], flow: "v3" });
    if (replay) services.track("onboarding_completed");
    markNavRise(sessionFlagStore(), Date.now());
    setLeaving(true);
    void wait(handoffExitMs(reduced)).then(() => {
      if (!mounted.current) return;
      if (onHandoff) onHandoff(clockHref);
      else router.push(clockHref);
    });
  }

  // Forward completes the screen being left. Back completes nothing.
  function go(to: number) {
    blurField();
    if (to > screen) {
      services.track("onboarding_step_completed", { step_name: V3_STEPS[screen], flow: "v3" });
    }
    moves.current += 1;
    setUwMorph(null);
    dispatch({ type: "go", to });
  }

  // Back from the UW page is the welcome (the reducer's back).
  function back() {
    if (leaving) return;
    blurField();
    moves.current += 1;
    setUwMorph(null);
    dispatch({ type: "back" });
  }

  // D6: a replayer's way out, from any screen. It writes nothing further.
  // Whatever earlier screens already saved stays saved, as it would have in
  // v2 (Replay writes for real, D15).
  function close() {
    if (leaving) return;
    blurField();
    router.push("/");
  }

  // On from `from` once a save started there lands: made as the save starts,
  // it moves the wizard on only if nothing has moved it since, Back and on
  // again to `from` included, which the screen alone can't tell from staying
  // (a save left in flight would carry the re-entered screen on), and only
  // while the wizard is mounted.
  function advanceLater(from: number): () => void {
    const at = moves.current;
    return () => {
      if (mounted.current && moves.current === at && screenNow.current === from) go(from + 1);
    };
  }

  // The welcome's Continue (the CTA, or Return in the username field):
  // through welcomeContinue's gate, the identity's writes, then the UW sheet
  // (UW on) or Screen 2. Only from the welcome: Back can't leave it, but the
  // replay ✕ can, and nothing then follows.
  function continueWelcome() {
    const plan = welcomeContinue({ uwEnabled: uw, valid: welcomeValid, saving: welcomeSaving });
    if (plan.kind === "ignore") return;
    const next = advanceLater(SCREEN.identity);
    welcomeRef.current?.save((saved) => {
      setShown(saved);
      if (!mounted.current || screenNow.current !== SCREEN.identity) return;
      if (plan.then !== "uwSheet") {
        next();
        return;
      }
      // The welcome's keyboard goes down as the sheet comes up.
      blurField();
      dispatch({ type: "openUwSheet" });
    });
  }

  // A UW tile tapped (R:76-80), counted only from the sheet's tiles with no
  // save in flight (uwTileTap). Yes then holds its selected state and opens
  // on its own (uw-sheet.tsx). No is saved here.
  function tapUw(choice: UwChoice) {
    const tap = uwTileTap({
      screen,
      uwSheet: wizard.uwSheet,
      uwPhase: wizard.uwPhase,
      busy: uwWrites.saving,
    });
    if (tap === "ignore") return;
    dispatch({ type: "pickUw", choice });
    if (choice === "no") chooseNo();
  }

  // "No" (R:79): the tile holds its selected state for 780ms, then the sheet
  // goes and Screen 2 comes. { isUw: false } is saved in the meantime, which
  // clears whatever UW data the profile had (uwProfilePayload), and the
  // wizard moves on once both the wait and the write are done.
  //
  // A failed write depends on what there was to clear. Someone the page has
  // in the cohort would stay listed, so it toasts and the tiles ask again.
  // Anyone else is out of the cohort already, so the write changes nothing
  // they can see: it fails quietly and moves on anyway, rather than hold them
  // on the welcome (P11's column drops would otherwise strand every new
  // UW-on user there). It's still written, since a profile read that failed
  // also looks like "not in the cohort".
  function chooseNo() {
    const inCohort = uwWrites.inCohort;
    const saved = new Promise<"saved" | "failed" | "busy">((resolve) => {
      const writing = uwWrites.save(uwExitInput({ kind: "no" }), () => resolve("saved"), {
        onFailed: () => resolve("failed"),
        quiet: !inCohort,
      });
      if (!writing) resolve("busy");
    });
    void Promise.all([saved, wait(uwDelay("noAdvanceMs", reduced))]).then(([out]) => {
      if (!mounted.current || screenNow.current !== SCREEN.identity) return;
      if (out === "saved" || (out === "failed" && !inCohort)) go(SCREEN.goal);
      else dispatch({ type: "changeUw" });
    });
  }

  // The Yes path's Skip or Continue (R:88), with the lists as the sheet
  // committed them: the Yes path saved, then Screen 2. The listing is the
  // reducer's uwListed: true for a Yes tapped in the sheet this run, beside
  // the disclosure, and a replayer's stored value otherwise (D2). A save that
  // settles once the bar has gone back to the tiles, or the sheet has gone,
  // goes no further; Change and dismissing are ignored while one is in
  // flight, so that's a guard, not a path.
  function exitYes(lists: { majors: string[]; interests: string[] }) {
    const input = uwExitInput({ kind: "yes", ...lists, listed: wizard.uwListed });
    const next = advanceLater(SCREEN.identity);
    uwWrites.save(input, () => {
      if (uwNow.current.phase === "open" && uwNow.current.page) next();
    });
  }

  // Yes has held its selected state in the sheet: the sheet goes and the UW
  // page comes, its bar morphing from the tile.
  function openUwPage(tile: Box | null) {
    setUwMorph(tile);
    dispatch({ type: "openUw" });
  }

  // The bar's Change, on the UW page: the question again, over the welcome.
  function changeUw() {
    setUwMorph(null);
    dispatch({ type: "changeUw" });
  }

  // Put away unanswered, when it may be (uwSheetDismissible).
  const sheetDismissible = uwSheetDismissible({
    uwSheet: wizard.uwSheet,
    uwPhase: wizard.uwPhase,
    busy: uwWrites.saving,
  });
  function dismissUw() {
    if (sheetDismissible) dispatch({ type: "closeUwSheet" });
  }

  // A goal typed on Screen 2, as the reducer adds it: on the row it will be
  // saved on when that row already has this title (a goal removed and typed
  // back, or a replayer's own), at that row's quota, so typing it again
  // writes nothing, and at 5h on no row yet otherwise (newGoalHours).
  function addGoalAction(s: WizardState, title: string): WizardAction {
    const { hours, rowId } = newGoalHours(
      goalWrites.rows,
      s.goals,
      s.goalHours,
      s.goalRowIds,
      formatGoalTitle(title)
    );
    return { type: "addGoal", title, hours, rowId };
  }

  // Screen 2's Continue (the CTA, or Return on an empty field). Hours still
  // being typed into any box are applied first, then a typed draft joins the
  // list, as the prototype commits it (P:940-944), so a failed save leaves
  // them all on screen rather than lost. The reducer is run here as well as
  // dispatched, to save the lists it produces in the same tick. Once the
  // save settles, however far it got, the reducer keeps the row each goal
  // ended up on (setGoalRowIds), for the list it saved.
  function continueGoals(draft: string, edits: readonly GoalHoursEdit[]) {
    let next = wizard;
    const apply = (action: WizardAction) => {
      const after = wizardReducer(next, action);
      if (after === next) return;
      dispatch(action);
      next = after;
    };
    for (const { index, hours } of edits) apply({ type: "setGoalHours", index, hours });
    if (draft) apply(addGoalAction(next, draft));
    const saving = next;
    if (saving.goals.length === 0) return;
    goalWrites.save(
      saving.goals,
      saving.goalHours,
      saving.goalRowIds,
      (ids) => dispatch({ type: "setGoalRowIds", ids, goals: saving.goals }),
      advanceLater(SCREEN.goal)
    );
  }

  // Screen 3's Continue or Skip, with anything typed in "Your own" added and
  // selected first (P:991).
  function continueHabits(custom: string) {
    const next = custom ? wizardReducer(wizard, { type: "addCustomHabit", name: custom }) : wizard;
    if (next !== wizard) dispatch({ type: "addCustomHabit", name: custom });
    habitWrites.save(next.habits, advanceLater(SCREEN.habits));
  }

  // Screen 4's way on (the CTA, a tap, a swipe or the right arrow): the next
  // beat, or Screen 5 from the last one (P:1035). Leaving goes through go()
  // rather than the reducer's own nextBeat, so it counts as completing the
  // intro, as every other forward move completes its screen.
  function nextBeat() {
    if (wizard.beat >= INTRO_BEATS - 1) go(SCREEN.friends);
    else dispatch({ type: "nextBeat" });
  }

  // Screen 5's Add and "✓ Added". The first person added turns the CTA
  // primary, and a ring pulses out from it as it does (R:143).
  function toggleFriend(person: AddPerson) {
    if (friendAdds.toggle(person)) ctaRef.current?.pulseRing();
  }

  // Screen 2's goals in the colors it drew them in, for the intro's square,
  // post and sample week. A replayer's own goal keeps its own color.
  const shownGoalColors = goalColors(
    goalWrites.rows,
    wizard.goals,
    wizard.goalHours,
    wizard.goalRowIds
  ).colors;

  // Screen 5's UW groups (P9d) are for a UW student, with UW on: the answer
  // the sheet saved on its way out, Yes and its lists, which is all the
  // wizard can have when it's past Screen 1. Anyone else, or UW off, gets
  // Screen 5 as it was. The screen fetches the groups itself, keyed by these
  // lists (lib/uw-groups.ts, uwFetchKey), from the moment the wizard leaves
  // Screen 1 (uwReady), which is after the save the RPC reads.
  const screen5Uw =
    uw && wizard.uw === "yes" ? { majors: wizard.majors, interests: wizard.interests } : null;

  // The UW page's items: in front while it is, exited up once the wizard has
  // moved on past Screen 1, waiting below otherwise.
  const uwPagePhase: ItemPhase = uwPageShown
    ? "active"
    : screen > SCREEN.identity
      ? "past"
      : "ahead";

  let cta: CtaSpec;
  if (uwPageShown) {
    // The UW page's own (R:88): "Skip for now" until a major or interest is
    // added or typed, then "Continue", which commits what's typed. Either
    // saves the Yes path, then Screen 2.
    const page = uwPageCta({
      uwPhase: wizard.uwPhase,
      hasUwInput: hasUwInput(wizard.majors, wizard.interests, uwHasDraft),
    });
    cta = {
      label: page?.label ?? "Skip for now",
      variant: page?.variant ?? "secondary",
      busy: uwWrites.saving,
      onPress: () => uwScreenRef.current?.exit(),
    };
  } else if (screen === SCREEN.identity) {
    // "Continue", disabled until the handle passes v2's rules, busy while the
    // identity saves. Under the UW sheet it stays, dimmed with the welcome.
    cta = {
      label: "Continue",
      disabled: !welcomeValid,
      busy: welcomeSaving,
      onPress: continueWelcome,
    };
  } else if (screen === SCREEN.goal) {
    // Disabled until there's a goal or a draft, and it commits the draft
    // (R:96).
    cta = {
      label: "Continue",
      disabled: wizard.goals.length === 0 && !goalHasDraft,
      busy: goalWrites.saving,
      onPress: () => goalScreenRef.current?.continue(),
    };
  } else if (screen === SCREEN.habits) {
    // "Skip for now" until a habit is picked, then "Continue" (R:104).
    const picked = wizard.habits.length > 0;
    cta = {
      label: picked ? "Continue" : "Skip for now",
      variant: picked ? "primary" : "secondary",
      busy: habitWrites.saving,
      onPress: () => habitsScreenRef.current?.continue(),
    };
  } else if (screen === SCREEN.intro) {
    // "Next" through the beats, "Continue" on the last (R:126).
    cta = { label: introCtaLabel(wizard.beat), onPress: nextBeat };
  } else if (screen === SCREEN.friends) {
    // "Skip for now" until someone's added, then "Continue · {n} added"
    // (R:143). Every request was sent on its tap, so this only moves on.
    cta = { ...friendsCta(friendAdds.count), onPress: () => go(SCREEN.ready) };
  } else if (screen === SCREEN.ready) {
    // The link to the Clock tab, fully prefetched from the moment Screen 6
    // is in front (D7). The screen writes nothing itself, so the only purge
    // it can meet is a Screen 5 request landing after it arrived, and Next
    // prefetches a link in view again when the router's tree changes. It
    // stays in place through the exit, a second tap ignored (startSession),
    // as the prototype's one CTA does (P:1228).
    cta = {
      label: "Start session",
      href: clockHref,
      prefetch: true,
      onPress: startSession,
    };
  } else {
    cta = { label: "Continue", onPress: () => go(screen + 1) };
  }

  return (
    <div data-onboarding-v3 className={V3_FRAME}>
      <KeyboardInsetVar />
      {/* Inert under the UW sheet, which is a modal dialog over it. */}
      <div ref={columnRef} className={V3_COLUMN} inert={sheetUp || undefined}>
        <WizardChrome
          screen={screen}
          welcome={screen === SCREEN.identity && !uwPageShown}
          reduced={reduced}
          onBack={back}
          onClose={replay ? close : undefined}
          avatar={{
            name: shown.displayName,
            colorKey: shown.colorKey,
            photoUrl: photo.photoUrl,
          }}
          leaving={leaving}
        />

        <div className="relative min-h-0 flex-1">
          {Array.from({ length: SCREEN_COUNT }, (_, i) => {
            // Leaving takes Screen 6 forward out of view, as Continue does
            // every other screen, and the UW page the welcome.
            const phase =
              (leaving && i === screen) || (i === SCREEN.identity && uwPageShown)
                ? "past"
                : phaseFor(i, screen);
            const active = phase === "active";
            return (
              <section
                key={V3_STEPS[i]}
                data-screen={i}
                aria-label={SCREEN_LABELS[i]}
                inert={!active}
                aria-hidden={!active || undefined}
                className={cn("absolute inset-0 outline-none", !active && "pointer-events-none")}
              >
                {i === SCREEN.identity ? (
                  <WelcomeScreen
                    ref={welcomeRef}
                    phase={phase}
                    reduced={reduced}
                    services={services}
                    photo={photo}
                    initialDisplayName={initialDisplayName}
                    initialUsername={initialUsername}
                    usernameDraft={usernameDraft}
                    onValid={setWelcomeValid}
                    onSaving={setWelcomeSaving}
                    onSubmit={continueWelcome}
                  />
                ) : i === SCREEN.goal ? (
                  <GoalScreen
                    ref={goalScreenRef}
                    phase={phase}
                    reduced={reduced}
                    goals={wizard.goals}
                    goalHours={wizard.goalHours}
                    goalRowIds={wizard.goalRowIds}
                    rows={goalWrites.rows}
                    busy={goalWrites.saving}
                    initialDraft={goalDraft}
                    onAdd={(title) => dispatch(addGoalAction(wizard, title))}
                    onRemove={(index) => dispatch({ type: "removeGoal", index })}
                    onSetHours={(index, hours) => dispatch({ type: "setGoalHours", index, hours })}
                    onContinue={continueGoals}
                    onDraftChange={setGoalHasDraft}
                  />
                ) : i === SCREEN.habits ? (
                  <HabitsScreen
                    ref={habitsScreenRef}
                    phase={phase}
                    reduced={reduced}
                    habits={wizard.habits}
                    customHabits={wizard.customHabits}
                    busy={habitWrites.saving}
                    initialDraft={habitDraft}
                    onToggle={(name) => dispatch({ type: "toggleHabit", name })}
                    onAddCustom={(name) => dispatch({ type: "addCustomHabit", name })}
                    onContinue={continueHabits}
                  />
                ) : i === SCREEN.intro ? (
                  <IntroScreen
                    phase={phase}
                    reduced={reduced}
                    beat={wizard.beat}
                    name={shown.displayName}
                    colorKey={shown.colorKey}
                    photoUrl={photo.photoUrl}
                    goals={wizard.goals}
                    goalColors={shownGoalColors}
                    firstHabit={wizard.habits[0] ?? null}
                    week={weekSegments}
                    onNext={nextBeat}
                    onPrev={() => dispatch({ type: "prevBeat" })}
                    onSkip={() => go(SCREEN.friends)}
                  />
                ) : i === SCREEN.friends ? (
                  <FindFriendsScreen
                    phase={phase}
                    reduced={reduced}
                    goal={wizard.goals[0] ?? null}
                    adds={friendAdds.adds}
                    onToggleAdd={toggleFriend}
                    relations={relations}
                    accept={services.acceptFriendRequest}
                    search={services.searchUsers}
                    share={services.shareInvite}
                    onToast={(text) => toastRef.current?.show(text)}
                    initialQuery={searchDraft}
                    uw={screen5Uw}
                    uwReady={screen > SCREEN.identity}
                    fetchUwGroups={services.fetchUwPeerGroups}
                    fetchMoreUw={services.fetchMoreUwPeers}
                  />
                ) : (
                  <ReadyScreen
                    phase={phase}
                    reduced={reduced}
                    goal={firstGoal}
                    added={friendAdds.count}
                    pending={friendAdds.count}
                  />
                )}
              </section>
            );
          })}

          {/* The UW page (OWNER-FIX-4), between the welcome and Screen 2 for a
              Yes: ahead of the welcome until it's in front, behind it once
              the wizard has moved on. */}
          {uw && (
            <section
              data-screen="uw"
              aria-label="Your UW details"
              inert={!uwPageShown}
              aria-hidden={!uwPageShown || undefined}
              className={cn("absolute inset-0 outline-none", !uwPageShown && "pointer-events-none")}
            >
              <UwScreen
                ref={uwScreenRef}
                phase={uwPagePhase}
                reduced={reduced}
                majors={wizard.majors}
                interests={wizard.interests}
                listed={wizard.uwListed}
                busy={uwWrites.saving}
                morphFrom={uwPageShown ? uwMorph : null}
                onMajors={(majors) => dispatch({ type: "setMajors", majors })}
                onInterests={(interests) => dispatch({ type: "setInterests", interests })}
                onDraftChange={setUwHasDraft}
                onChange={changeUw}
                onExit={exitYes}
              />
            </section>
          )}
        </div>

        <OnboardingCta ref={ctaRef} spec={cta} reduced={reduced} />
      </div>
      {uw && (
        <UwSheet
          open={sheetUp}
          reduced={reduced}
          uw={wizard.uw}
          uwPhase={wizard.uwPhase}
          inCohort={uwWrites.inCohort}
          dismissible={sheetDismissible}
          onTap={tapUw}
          onOpen={openUwPage}
          onDismiss={dismissUw}
        />
      )}
      <PillToast ref={toastRef} />
    </div>
  );
}
