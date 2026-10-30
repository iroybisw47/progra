"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";

import { useFriendAdds } from "@/components/v2/person-row";
import { PillToast, type PillToastHandle } from "@/components/v2/pill-toast";
import { goalFillHex } from "@/lib/colors";
import {
  NO_RELATIONS,
  addsFromOutgoing,
  type AddPerson,
  type FriendRelations,
} from "@/lib/find-friends";
import { clockHandoffHref } from "@/lib/clock-handoff";
import { CLOCK_REMINDERS, NUDGES, RECAP_PUSH, SOCIAL_PUSH, STREAKS } from "@/lib/flags";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { handoffExitMs, type Box, type ItemPhase } from "@/lib/motion";
import { markNavRise, sessionFlagStore } from "@/lib/nav-rise";
import {
  formatGoalTitle,
  friendsCta,
  notifyReasons,
  notifyScreenShown,
} from "@/lib/onboarding-v3";
import {
  newGoalHours,
  prefillWizard,
  readyGoal,
  type AccountGoal,
  type AccountHabit,
} from "@/lib/onboarding-v3-goals-habits";
import { phaseFor, welcomeHandle, welcomeShown } from "@/lib/onboarding-v3-identity";
import {
  hasUwInput,
  uwDelay,
  uwExitInput,
  uwPageCta,
  uwSheetDismissible,
  uwStartState,
  uwStoredInput,
} from "@/lib/onboarding-v3-uw";
import type { OnboardingV3Services } from "@/lib/onboarding-v3-services";
import {
  HOW_STEPS,
  V4_GOAL_EXAMPLES,
  V4_SCREEN,
  V4_SCREEN_COUNT,
  V4_STEPS,
  firstGoal,
  habitColor,
  habitsCtaLabel,
  initialV4State,
  nextGoalColor,
  prefillHabits,
  progressFill,
  screenTotal,
  stepEyebrow,
  v4Reducer,
  type V4Action,
  type V4State,
} from "@/lib/onboarding-v4";
import type { NotifyPermission } from "@/lib/notification-permission";
import { useNotificationPermission } from "@/lib/use-notification-permission";
import type { UwChoice } from "@/lib/onboarding-v3";
import type { SavedUw } from "@/lib/uw-fields";
import { cn } from "@/lib/utils";

import { FindFriendsScreen } from "./v3/find-friends-screen";
import {
  GoalScreen,
  useGoalWrites,
  type GoalHoursEdit,
  type GoalScreenHandle,
} from "./v3/goal-screen";
import { useHabitWrites } from "./v3/habits-screen";
import {
  KeyboardInsetVar,
  OnboardingCta,
  type CtaSpec,
  type OnboardingCtaHandle,
} from "./v3/onboarding-cta";
import { REAL_SERVICES } from "./v3/services";
import { UwScreen, type UwScreenHandle } from "./v3/uw-screen";
import { useUwWrites } from "./v3/uw-writes";
import { V3_COLUMN, V3_FRAME } from "./v3/frame";
import { WelcomeScreen, useWelcomePhoto, type WelcomeScreenHandle } from "./v3/welcome-screen";
import { WizardChrome } from "./v3/wizard-chrome";
import { HabitsScreen, type HabitsScreenHandle } from "./v4/habits-screen";
import { HowScreen } from "./v4/how-screen";
import { NotifyScreen } from "./v4/notify-screen";
import { PracticeClockScreen } from "./v4/practice-clock-screen";
import { PracticePostScreen } from "./v4/practice-post-screen";
import { SkipLink, type SkipSpec } from "./v4/skip-link";

// Dialogs load as their own chunks (AGENTS.md). The UW sheet only with UW on,
// requested as the wizard mounts, well before the post's Continue raises it.
const UwSheet = dynamic(() => import("./v3/uw-sheet").then((m) => m.UwSheet), { ssr: false });
// The goal color sheet, as soon as Screen 1 can open it.
const GoalColorSheet = dynamic(
  () => import("./v4/goal-color-sheet").then((m) => m.GoalColorSheet),
  { ssr: false }
);

// Onboarding v4 (design_handoff_onboarding_v4/README.md), behind ONBOARDING_V4:
// eight screens in v3's shell (the top row, one CTA, every screen mounted and
// crossfading on the shared item motion), plus a skip link under the CTA.
//
//   0 welcome      v3's, as is; Continue saves the identity and goes on
//   1 goal         v3's, with four example chips and a color per goal
//   2 habits       v2's habits step, ported into the shell
//   3 how          "How Progra works", four steps on one screen
//   4 clock        v2's practice clock-in
//   5 post         v2's practice post; its Continue raises the UW sheet
//                  (UW on), whose Yes opens the UW page over it
//   6 friends      v3's find your friends
//   7 notify       a new notifications screen, last, while iOS can still ask
//
// Where the notifications screen isn't shown (the website, or a device iOS
// has already asked), find your friends is last, the bar counts seven, and
// its CTA hands off. The hand-off is v3's: the last screen's items exit, the
// top row fades, then the whole wizard fades to white and the Clock tab
// replaces it with goal 1 preselected; a leaf there stamps onboarded_at
// (app/clock/finish-onboarding.tsx).
//
// Navigation is lib/onboarding-v4.ts's v4Reducer. The writes are v3's hooks:
// the identity on the welcome's Continue, the goals (now with their picked
// colors) on Screen 1's, the habits (with their tiles' colors) on Screen 2's,
// the UW answer on the way out of the sheet or page, friend requests on each
// Add. The practice screens write nothing.
//
// Everything that leaves the browser goes through `services`, so the dev
// preview (app/dev/onboarding-v4) can run every screen on fakes.
type Props = {
  initialUsername: string;
  initialDisplayName: string | null;
  avatarUrl: string | null;
  // onboarded_at is already set: Settings → Replay, with the quiet ✕.
  replay: boolean;
  existingGoals: AccountGoal[];
  existingHabits: AccountHabit[];
  relations?: FriendRelations;
  // NEXT_PUBLIC_UW: the post's Continue raises the UW sheet. Off, it goes
  // straight to find your friends.
  uw?: boolean;
  savedUw?: SavedUw;
  // Dev preview only (app/dev/onboarding-v4). Production passes none of these.
  services?: OnboardingV3Services;
  initialScreen?: number;
  initialHowStep?: number;
  // The UW sheet up over the post, with this tile held; or the UW page.
  initialUwSheet?: boolean;
  initialUwSelected?: UwChoice;
  initialUwPage?: boolean;
  // The practice post opens already posted.
  initialPosted?: boolean;
  usernameDraft?: string;
  goalDraft?: string;
  habitDraft?: string;
  searchDraft?: string;
  onHandoff?: (href: string) => void;
  notifyPermission?: NotifyPermission | null;
};

const NOTIFY_REASONS = notifyReasons({
  clockReminders: CLOCK_REMINDERS,
  socialPush: SOCIAL_PUSH,
  nudges: NUDGES,
  recapPush: RECAP_PUSH,
  streaks: STREAKS,
});

// Each screen's section label, for assistive tech, by screen index.
const SCREEN_LABELS = [
  "Welcome",
  "Your goal",
  "Your habits",
  "How Progra works",
  "Try clocking in",
  "Show your work",
  "Find your friends",
  "Allow notifications",
];

// The whole wizard fading to white once the last screen's exit has played
// (R:38). Opacity only, so reduced motion keeps it.
const FADE_OUT_MS = 320;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startAt({
  screen,
  howStep,
  goals,
  habits,
  uw,
  savedUw,
  sheet,
  selected,
  page,
}: {
  screen: number;
  howStep: number;
  goals: AccountGoal[];
  habits: AccountHabit[];
  uw: boolean;
  savedUw: SavedUw | undefined;
  sheet: boolean;
  selected: UwChoice | undefined;
  page: boolean;
}): V4State {
  const at = Number.isInteger(screen) ? Math.min(Math.max(screen, 0), V4_SCREEN_COUNT - 1) : 0;
  const { goals: titles, goalHours, goalRowIds } = prefillWizard(goals, []);
  // A replayer's goals start in their own colors.
  const byId = new Map(goals.map((g) => [g.id, g]));
  const goalColors = goalRowIds.map((id) => {
    const g = id ? byId.get(id) : undefined;
    return g ? goalFillHex(g) : nextGoalColor([]);
  });
  let start: V4State = {
    ...initialV4State(),
    goals: titles,
    goalHours,
    goalRowIds,
    goalColors,
    ...prefillHabits(habits),
    ...uwStartState(savedUw, uw),
    screen: at,
  };
  if (at === V4_SCREEN.how && Number.isInteger(howStep)) {
    start.howStep = Math.min(Math.max(howStep, 0), HOW_STEPS - 1);
  }
  if (uw && at === V4_SCREEN.post) {
    if (page) {
      start = {
        ...start,
        uw: "yes",
        uwPhase: "open",
        uwListed: start.uw === "yes" ? start.uwListed : true,
        uwPage: true,
      };
    } else if (sheet) {
      start = selected
        ? { ...start, uwSheet: true, uw: selected, uwPhase: "selecting" }
        : { ...start, uwSheet: true };
    }
  }
  return start;
}

function blurField() {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur();
}

function focusLost(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return true;
  return el.matches(":disabled") || el.closest("[inert], [aria-hidden='true']") !== null;
}

function focusSection(section: HTMLElement | null | undefined) {
  if (!section) return;
  section.setAttribute("tabindex", "-1");
  section.addEventListener("blur", () => section.removeAttribute("tabindex"), { once: true });
  section.focus({ preventScroll: true });
}

export function OnboardingClientV4({
  initialUsername,
  initialDisplayName,
  avatarUrl,
  replay,
  existingGoals,
  existingHabits,
  relations = NO_RELATIONS,
  uw = false,
  savedUw,
  services = REAL_SERVICES,
  initialScreen = V4_SCREEN.welcome,
  initialHowStep = 0,
  initialUwSheet = false,
  initialUwSelected,
  initialUwPage = false,
  initialPosted = false,
  usernameDraft,
  goalDraft,
  habitDraft,
  searchDraft,
  onHandoff,
  notifyPermission,
}: Props) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const [wizard, dispatch] = useReducer(
    v4Reducer,
    {
      screen: initialScreen,
      howStep: initialHowStep,
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
  const sheetUp = uw && wizard.uwSheet && screen === V4_SCREEN.post;
  const uwPageShown = uw && wizard.uwPage && screen === V4_SCREEN.post;
  const view = uwPageShown ? "uw" : String(screen);

  const columnRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<PillToastHandle>(null);
  const ctaRef = useRef<OnboardingCtaHandle>(null);

  // The welcome (v3's): its fields live in the screen.
  const welcomeRef = useRef<WelcomeScreenHandle>(null);
  const [welcomeValid, setWelcomeValid] = useState(
    () => welcomeHandle(usernameDraft ?? initialUsername).valid
  );
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [shown, setShown] = useState(() => welcomeShown(initialDisplayName, initialUsername));
  const photo = useWelcomePhoto(avatarUrl, services);
  const uwWrites = useUwWrites(services, uw ? uwStoredInput(savedUw) : null);
  const uwScreenRef = useRef<UwScreenHandle>(null);
  const [uwHasDraft, setUwHasDraft] = useState(false);
  const [uwMorph, setUwMorph] = useState<Box | null>(null);
  const goalWrites = useGoalWrites({ services, account: existingGoals });
  const habitWrites = useHabitWrites({
    services,
    account: existingHabits,
    colorFor: (name) => habitColor(name, wizard.customHabits),
  });
  const friendAdds = useFriendAdds({
    send: services.sendFriendRequest,
    remove: services.cancelFriendRequest,
    initial: addsFromOutgoing(relations.outgoing),
    onSent: (userId) => services.track("friend_request_sent", { target_id: userId }),
  });
  const goalScreenRef = useRef<GoalScreenHandle>(null);
  // The goal whose color sheet is up, by index, or null. The last one shown
  // stays drawn in the sheet as it closes.
  const [colorFor, setColorFor] = useState<number | null>(null);
  const [colorShown, setColorShown] = useState(0);
  const habitsScreenRef = useRef<HabitsScreenHandle>(null);
  const [goalHasDraft, setGoalHasDraft] = useState(() => (goalDraft ?? "").trim().length > 0);
  const [habitHasDraft, setHabitHasDraft] = useState(
    () => (habitDraft ?? "").trim().length > 0
  );

  // The practice screens' state, none of it saved (R:155): whether the timer
  // runs (for the clock-in's CTA), the session's name as Clock in took it,
  // and whether the post went out.
  const [clockRunning, setClockRunning] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [posted, setPosted] = useState(initialPosted);

  // The notifications screen: shown while iOS can still ask, and part of the
  // run once it has been in front (v3's rule), so a grant made there doesn't
  // renumber the bar.
  const livePermission = useNotificationPermission();
  const permission = notifyPermission === undefined ? livePermission : notifyPermission;
  const [notifyEntered, setNotifyEntered] = useState(screen === V4_SCREEN.notify);
  if (screen === V4_SCREEN.notify && !notifyEntered) setNotifyEntered(true);
  const notifyShown = notifyEntered || notifyScreenShown(permission, NOTIFY_REASONS);
  const [asking, setAsking] = useState(false);
  // The hand-off: `leaving` exits the last screen's items and fades the top
  // row; `fading` then fades the whole wizard to white.
  const [leaving, setLeaving] = useState(false);
  const [fading, setFading] = useState(false);

  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    if (!focusLost()) return;
    focusSection(columnRef.current?.querySelector<HTMLElement>(`[data-screen="${view}"]`));
  }, [view]);

  // The sheet put away onto the post: focus back to the Continue that raised
  // it.
  const sheetWasUp = useRef(sheetUp);
  useEffect(() => {
    const was = sheetWasUp.current;
    sheetWasUp.current = sheetUp;
    if (!was || sheetUp || view !== String(V4_SCREEN.post) || !focusLost()) return;
    columnRef.current
      ?.querySelector<HTMLElement>("[data-onboarding-cta] button:not([tabindex='-1'])")
      ?.focus({ preventScroll: true });
  }, [sheetUp, view]);

  // Analytics: the screen just entered, with flow "v4".
  useEffect(() => {
    const step = V4_STEPS[screen];
    services.track("onboarding_step_viewed", { step_name: step, flow: "v4" });
    services.recordStep(step);
  }, [screen, services]);

  const screenNow = useRef(screen);
  useEffect(() => {
    screenNow.current = screen;
  }, [screen]);
  const moves = useRef(0);
  const uwNow = useRef({ phase: wizard.uwPhase, page: uwPageShown });
  useEffect(() => {
    uwNow.current = { phase: wizard.uwPhase, page: uwPageShown };
  }, [wizard.uwPhase, uwPageShown]);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const goal1 = firstGoal(wizard);
  const ready = readyGoal(
    goalWrites.rows,
    wizard.goals,
    wizard.goalHours,
    wizard.goalRowIds,
    wizard.goalColors
  );
  const clockHref = clockHandoffHref(ready?.id);

  // The hand-off from whichever screen is last (v3's startSession), then the
  // fade to white (R:38).
  function finish() {
    if (leaving) return;
    blurField();
    services.track("onboarding_step_completed", { step_name: V4_STEPS[screen], flow: "v4" });
    if (replay) services.track("onboarding_completed");
    markNavRise(sessionFlagStore(), Date.now());
    setLeaving(true);
    void wait(handoffExitMs(reduced))
      .then(() => {
        if (!mounted.current) return;
        setFading(true);
        return wait(FADE_OUT_MS);
      })
      .then(() => {
        if (!mounted.current) return;
        if (onHandoff) onHandoff(clockHref);
        else router.push(clockHref);
      });
  }

  function go(to: number) {
    blurField();
    if (to > screen) {
      services.track("onboarding_step_completed", { step_name: V4_STEPS[screen], flow: "v4" });
    }
    moves.current += 1;
    setUwMorph(null);
    if (to !== V4_SCREEN.clock) setClockRunning(false);
    dispatch({ type: "go", to });
  }

  // Top Back: a step back within How Progra works before leaving it (R:114),
  // the post from the UW page, else the screen before.
  function back() {
    if (leaving) return;
    blurField();
    moves.current += 1;
    setUwMorph(null);
    if (screen === V4_SCREEN.how && wizard.howStep > 0) {
      dispatch({ type: "prevHow" });
      return;
    }
    setClockRunning(false);
    dispatch({ type: "back" });
  }

  function close() {
    if (leaving) return;
    blurField();
    router.push("/");
  }

  function advanceLater(from: number): () => void {
    const at = moves.current;
    return () => {
      if (mounted.current && moves.current === at && screenNow.current === from) go(from + 1);
    };
  }

  // The welcome's Continue: the identity's writes, then Screen 1. It no
  // longer raises the UW sheet (R:75).
  function continueWelcome() {
    if (!welcomeValid || welcomeSaving) return;
    const next = advanceLater(V4_SCREEN.welcome);
    welcomeRef.current?.save((saved) => {
      setShown(saved);
      next();
    });
  }

  // ---- The UW question, over the posted practice session --------------------

  function tapUw(choice: UwChoice) {
    if (
      screen !== V4_SCREEN.post ||
      !wizard.uwSheet ||
      wizard.uwPhase !== "choose" ||
      uwWrites.saving
    ) {
      return;
    }
    dispatch({ type: "pickUw", choice });
    if (choice === "no") chooseNo();
  }

  // No: the tile holds, { isUw: false } saves, then find your friends (v3's
  // chooseNo, R:131).
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
      if (!mounted.current || screenNow.current !== V4_SCREEN.post) return;
      if (out === "saved" || (out === "failed" && !inCohort)) go(V4_SCREEN.friends);
      else dispatch({ type: "changeUw" });
    });
  }

  // The UW page's Skip or Continue: the Yes path saved, then find your friends.
  function exitYes(lists: { majors: string[]; interests: string[] }) {
    const input = uwExitInput({ kind: "yes", ...lists, listed: wizard.uwListed });
    const next = advanceLater(V4_SCREEN.post);
    uwWrites.save(input, () => {
      if (uwNow.current.phase === "open" && uwNow.current.page) next();
    });
  }

  function openUwPage(tile: Box | null) {
    setUwMorph(tile);
    dispatch({ type: "openUw" });
  }

  function changeUw() {
    setUwMorph(null);
    dispatch({ type: "changeUw" });
  }

  const sheetDismissible = uwSheetDismissible({
    uwSheet: wizard.uwSheet,
    uwPhase: wizard.uwPhase,
    busy: uwWrites.saving,
  });
  function dismissUw() {
    if (sheetDismissible) dispatch({ type: "closeUwSheet" });
  }

  // The post's Continue: the UW sheet (UW on), else find your friends.
  function continuePost() {
    if (!posted) return;
    if (!uw) {
      go(V4_SCREEN.friends);
      return;
    }
    blurField();
    dispatch({ type: "openUwSheet" });
  }

  // ---- Goals ------------------------------------------------------------------

  // A goal typed on Screen 1: on the row it will be saved on when that row
  // already has this title (v3's newGoalHours), in that row's own color, and
  // otherwise in the next default color (R:86).
  function addGoalAction(s: V4State, title: string): V4Action {
    const { hours, rowId } = newGoalHours(
      goalWrites.rows,
      s.goals,
      s.goalHours,
      s.goalRowIds,
      formatGoalTitle(title)
    );
    const row = rowId ? goalWrites.rows.find((r) => r.id === rowId) : undefined;
    const color = row ? goalFillHex(row) : nextGoalColor(s.goalColors);
    return { type: "addGoal", title, hours, rowId, color };
  }

  function continueGoals(draft: string, edits: readonly GoalHoursEdit[]) {
    let next = wizard;
    const apply = (action: V4Action) => {
      const after = v4Reducer(next, action);
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
      advanceLater(V4_SCREEN.goal),
      saving.goalColors
    );
  }

  // ---- Habits -----------------------------------------------------------------

  // "Save habit(s)", with anything typed added and selected first.
  function continueHabits(custom: string) {
    const next = custom ? v4Reducer(wizard, { type: "addCustomHabit", name: custom }) : wizard;
    if (next !== wizard) dispatch({ type: "addCustomHabit", name: custom });
    if (next.habits.length === 0) return;
    habitWrites.save(next.habits, advanceLater(V4_SCREEN.habits));
  }

  // ---- How Progra works --------------------------------------------------------

  function nextHow() {
    if (wizard.howStep >= HOW_STEPS - 1) go(V4_SCREEN.clock);
    else dispatch({ type: "nextHow" });
  }

  // ---- Friends and notifications -------------------------------------------------

  function toggleFriend(person: AddPerson) {
    if (friendAdds.toggle(person)) ctaRef.current?.pulseRing();
  }

  function askNotifications() {
    if (asking || screen !== V4_SCREEN.notify) return;
    setAsking(true);
    const at = moves.current;
    void services
      .askNotifications()
      .then(
        (result) => {
          services.track("notification_permission_asked", { source: "onboarding", result });
        },
        () => {}
      )
      .finally(() => {
        if (!mounted.current) return;
        setAsking(false);
        if (moves.current === at && screenNow.current === V4_SCREEN.notify) finish();
      });
  }

  function skipNotifications() {
    if (asking || leaving) return;
    services.track("notification_permission_skipped", {
      source: "onboarding",
      state: permission ?? "unknown",
    });
    finish();
  }

  const screen6Uw =
    uw && wizard.uw === "yes" ? { majors: wizard.majors, interests: wizard.interests } : null;

  const uwPagePhase: ItemPhase = uwPageShown
    ? "active"
    : screen > V4_SCREEN.post
      ? "past"
      : "ahead";

  // ---- The CTA and the skip link ----------------------------------------------

  let cta: CtaSpec;
  let skip: SkipSpec = null;
  const lastIsFriends = !notifyShown;
  if (uwPageShown) {
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
  } else if (screen === V4_SCREEN.welcome) {
    cta = {
      label: "Continue",
      disabled: !welcomeValid,
      busy: welcomeSaving,
      onPress: continueWelcome,
    };
  } else if (screen === V4_SCREEN.goal) {
    cta = {
      label: "Continue",
      disabled: wizard.goals.length === 0 && !goalHasDraft,
      busy: goalWrites.saving,
      onPress: () => goalScreenRef.current?.continue(),
    };
  } else if (screen === V4_SCREEN.habits) {
    // R:97: disabled until something is picked or typed. Skip writes nothing.
    cta = {
      label: habitsCtaLabel(wizard.habits.length),
      disabled: wizard.habits.length === 0 && !habitHasDraft,
      busy: habitWrites.saving,
      onPress: () => habitsScreenRef.current?.continue(),
    };
    skip = { label: "Skip for now", disabled: habitWrites.saving, onPress: () => go(V4_SCREEN.how) };
  } else if (screen === V4_SCREEN.how) {
    const last = wizard.howStep >= HOW_STEPS - 1;
    cta = { label: last ? "Try it" : "Next", onPress: nextHow };
    if (!last) skip = { label: "Skip", onPress: () => go(V4_SCREEN.clock) };
  } else if (screen === V4_SCREEN.clock) {
    // Disabled: the card's own button clocks in, and the screen moves on by
    // itself (R:122).
    cta = {
      label: clockRunning ? "Clocking in…" : "Clock in above to continue",
      disabled: true,
      onPress: () => {},
    };
  } else if (screen === V4_SCREEN.post) {
    cta = {
      label: posted ? "Continue" : "Post above to continue",
      disabled: !posted,
      onPress: continuePost,
    };
  } else if (screen === V4_SCREEN.friends && !lastIsFriends) {
    cta = { ...friendsCta(friendAdds.count), onPress: () => go(V4_SCREEN.notify) };
  } else if (screen === V4_SCREEN.friends) {
    // The last screen where notifications can't be asked: its CTA is the
    // prefetched link to the Clock tab (v3's D7).
    cta = { ...friendsCta(friendAdds.count), href: clockHref, prefetch: true, onPress: finish };
  } else {
    cta = {
      label: "Turn on notifications",
      href: clockHref,
      prefetch: true,
      onPress: askNotifications,
    };
    skip = { label: "Not now", disabled: asking, onPress: skipNotifications };
  }
  if (leaving) skip = null;

  const total = screenTotal(notifyShown);

  return (
    <div data-onboarding-v3 data-onboarding-v4 className={V3_FRAME}>
      <KeyboardInsetVar />
      <div
        ref={columnRef}
        className={V3_COLUMN}
        inert={sheetUp || fading || undefined}
        style={
          fading ? { opacity: 0, transition: `opacity ${FADE_OUT_MS}ms linear` } : undefined
        }
      >
        <WizardChrome
          screen={screen}
          welcome={screen === V4_SCREEN.welcome}
          reduced={reduced}
          onBack={back}
          onClose={replay ? close : undefined}
          progress={{ at: Math.min(screen, total - 1), of: total }}
          fill={progressFill(screen, wizard.howStep, notifyShown)}
          avatar={{
            name: shown.displayName,
            colorKey: shown.colorKey,
            photoUrl: photo.photoUrl,
          }}
          leaving={leaving}
        />

        <div className="relative min-h-0 flex-1">
          {Array.from({ length: V4_SCREEN_COUNT }, (_, i) => {
            const phase: ItemPhase =
              (leaving && i === screen) || (i === V4_SCREEN.post && uwPageShown)
                ? "past"
                : phaseFor(i, screen);
            const active = phase === "active";
            return (
              <section
                key={V4_STEPS[i]}
                data-screen={i}
                aria-label={SCREEN_LABELS[i]}
                inert={!active}
                aria-hidden={!active || undefined}
                className={cn("absolute inset-0 outline-none", !active && "pointer-events-none")}
              >
                {i === V4_SCREEN.welcome ? (
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
                ) : i === V4_SCREEN.goal ? (
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
                    examples={V4_GOAL_EXAMPLES}
                    picked={{
                      colors: wizard.goalColors,
                      next: nextGoalColor(wizard.goalColors),
                      onOpen: (index) => {
                        blurField();
                        setColorShown(index);
                        setColorFor(index);
                      },
                    }}
                  />
                ) : i === V4_SCREEN.habits ? (
                  <HabitsScreen
                    ref={habitsScreenRef}
                    phase={phase}
                    reduced={reduced}
                    eyebrow={stepEyebrow(V4_SCREEN.habits, notifyShown)}
                    habits={wizard.habits}
                    customHabits={wizard.customHabits}
                    busy={habitWrites.saving}
                    initialDraft={habitDraft}
                    onToggle={(name) => dispatch({ type: "toggleHabit", name })}
                    onAddCustom={(name) => dispatch({ type: "addCustomHabit", name })}
                    onDraftChange={setHabitHasDraft}
                    onContinue={continueHabits}
                  />
                ) : i === V4_SCREEN.how ? (
                  <HowScreen
                    phase={phase}
                    reduced={reduced}
                    step={wizard.howStep}
                    name={shown.displayName}
                    colorKey={shown.colorKey}
                    photoUrl={photo.photoUrl}
                    goal={goal1}
                    onNext={nextHow}
                    onPrev={() => dispatch({ type: "prevHow" })}
                  />
                ) : i === V4_SCREEN.clock ? (
                  <PracticeClockScreen
                    phase={phase}
                    reduced={reduced}
                    eyebrow={stepEyebrow(V4_SCREEN.clock, notifyShown, true)}
                    goal={goal1}
                    onRunning={setClockRunning}
                    onStart={setSessionName}
                    onDone={() => {
                      if (screenNow.current === V4_SCREEN.clock) go(V4_SCREEN.post);
                    }}
                  />
                ) : i === V4_SCREEN.post ? (
                  <PracticePostScreen
                    phase={phase}
                    reduced={reduced}
                    eyebrow={stepEyebrow(V4_SCREEN.post, notifyShown, true)}
                    name={shown.displayName}
                    username={shown.colorKey}
                    sessionName={sessionName}
                    goal={goal1}
                    posted={posted}
                    onPost={() => setPosted(true)}
                  />
                ) : i === V4_SCREEN.friends ? (
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
                    uw={screen6Uw}
                    uwReady={screen > V4_SCREEN.post}
                    fetchUwGroups={services.fetchUwPeerGroups}
                    fetchMoreUw={services.fetchMoreUwPeers}
                  />
                ) : (
                  <NotifyScreen phase={phase} reduced={reduced} goal={goal1} />
                )}
              </section>
            );
          })}

          {/* The UW page, between the post and find your friends for a Yes. */}
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
        <SkipLink spec={skip} />
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
      <GoalColorSheet
        open={colorFor !== null && screen === V4_SCREEN.goal}
        title={wizard.goals[colorShown] ?? ""}
        color={wizard.goalColors[colorShown] ?? nextGoalColor([])}
        onPick={(color) => {
          if (colorFor !== null) dispatch({ type: "setGoalColor", index: colorFor, color });
        }}
        onClose={() => setColorFor(null)}
      />
      <PillToast ref={toastRef} />
    </div>
  );
}
