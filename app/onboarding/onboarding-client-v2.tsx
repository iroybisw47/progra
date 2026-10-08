"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeftIcon } from "lucide-react";

import { setOnboardingStep } from "@/app/actions/telemetry";
import { archiveHabit, createHabit } from "@/app/actions/habits";
import { createGoal, updateGoal } from "@/app/actions/goals";
import { fetchUwPeers, setUwProfile } from "@/app/actions/uw";
import { sendFriendRequest } from "@/app/actions/friends";
import {
  completeOnboarding,
  setProfileIdentity,
  setUsername,
} from "@/app/actions/profile";
import { PrimaryButton } from "@/components/v2/primary-button";
import { track } from "@/lib/analytics";
import { HABIT_REMINDERS } from "@/lib/flags";
import {
  DEFAULT_HABIT_REMINDER_TIME,
  setHabitReminderPref,
} from "@/lib/habit-reminder-prefs";
import { shareInvite } from "@/lib/invite-share";
import { requestNotificationPermission } from "@/lib/notification-permission";
import {
  DEFAULT_GOAL_COLOR,
  activeSteps,
  doneSummary,
  eyebrowFor,
  inviteMessage,
  nextHabitColor,
  type HabitPick,
  type Step,
} from "@/lib/onboarding";
import { type UwPeer } from "@/lib/uw";
import { checkUsername } from "@/lib/social/username";
import { useIsNativeApp } from "@/lib/use-is-native-app";
import { useNotificationPermission } from "@/lib/use-notification-permission";
import { cn } from "@/lib/utils";

import { DoneSplash } from "./done-splash";
import { ClockStep } from "./steps/clock-step";
import { FriendsStep } from "./steps/friends-step";
import { GoalStep } from "./steps/goal-step";
import { HabitStep } from "./steps/habit-step";
import { HowStep } from "./steps/how-step";
import { NotifyStep } from "./steps/notify-step";
import { PostStep } from "./steps/post-step";
import { UwStep } from "./steps/uw-step";
import { WelcomeStep } from "./steps/welcome-step";

// How long the Done splash holds before home (long enough for GO! and the
// summary to land).
const SPLASH_MS = 3_200;

// First-run wizard (2026-09-15 redesign): who you are → how Progra works →
// first goal → habits → a practice clock-in → notifications (shell only) →
// a practice post → hold your friends accountable, and share → Ready, Set, GO!
//
// One action per step. The goal and habits are created for real through the
// same actions the app uses, so someone finishes with a week already set up.
// The practice clock-in, post and nudge write nothing and say so.
//
// This is the shell: every piece of state lives here and flows down to the
// step components as props, which is what lets Back keep everything typed.
// Each step remounts on entry (`key={step}`), so its rise-ins and the typed
// headline replay — coming back to a step feels like arriving at it.
//
// Saving twice must not create twice: Back → "Save goal" updates the goal it
// already made, and Back → "Save habits" creates only the new ones (and
// archives the ones un-picked).
type Props = {
  initialUsername: string;
  initialDisplayName: string | null;
  avatarUrl: string | null;
  // Dev preview only (app/onboarding/dev-preview, never shipped): open on a
  // given step / the splash. Production always starts at welcome.
  initialStep?: Step;
  initialDone?: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function OnboardingClientV2({
  initialUsername,
  initialDisplayName,
  avatarUrl,
  initialStep,
  initialDone = false,
}: Props) {
  const router = useRouter();
  // The wizard renders at `/` on the sign-in path and at `/onboarding` on the
  // Replay path, and finishing needs a DIFFERENT move in each case. Doing both
  // raced: the push re-applied the route's cached payload — still the wizard,
  // since staleTimes keeps it for 30s — over the refresh that had just fetched
  // the finished one, so Skip looked like it did nothing.
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  // Both conditional steps resolve while the user is still on `welcome` at
  // index 0 — the load-bearing reason the list changing length underneath
  // stepIndex is safe. It can never shift a step the user is partway through.
  // `native` flips at most once, immediately after hydration; `isUw` is a tick
  // on the welcome step itself. See activeSteps() in lib/onboarding.ts.
  const native = useIsNativeApp();
  // UW cohort (welcome tick → the `uw` step → setUwProfile). Seeded from
  // `?step=uw`, or previewing that step would land on whatever else sits at its
  // index in the list a non-UW student gets.
  const [isUw, setIsUw] = useState(initialStep === "uw");
  const [uwMajor, setUwMajor] = useState("");
  const [uwClubs, setUwClubs] = useState<string[]>([]);
  const [shareGoals, setShareGoals] = useState(true);
  // Suggested peers for the final step. null until the UW step has been
  // answered — which is also what FriendsStep reads to tell "not a UW student"
  // apart from "a UW student with no matches yet".
  const [peers, setPeers] = useState<UwPeer[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [addPending, setAddPending] = useState<string | null>(null);
  const steps = activeSteps(native, isUw);
  // -1 means "not navigated yet", so the starting point is resolved by NAME
  // against the live list on every render until the user moves. An index
  // captured once would be wrong the moment `steps` changes length — which it
  // does, when `native` flips just after hydration. Production always starts on
  // `welcome`, which is index 0 of every variant, so this is a no-op there and
  // only earns its keep for `?step=` previews.
  const [navIndex, setNavIndex] = useState(-1);
  const stepIndex =
    navIndex >= 0
      ? Math.min(navIndex, steps.length - 1)
      : Math.max(0, steps.indexOf(initialStep ?? "welcome"));
  const step = steps[stepIndex];
  const [done, setDone] = useState(initialDone);

  const notifyPermission = useNotificationPermission();

  // Identity (welcome).
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [username, setUsernameInput] = useState(initialUsername);
  const usernameCheck = username.trim() ? checkUsername(username) : null;
  const usernameError = usernameCheck && !usernameCheck.ok ? usernameCheck.error : null;
  const usernameValid = !!usernameCheck?.ok;
  const [claimed, setClaimed] = useState<{ username: string; displayName: string } | null>(
    null
  );

  // Goal — the title, colour and hours flow through every later step.
  const [goalTitle, setGoalTitle] = useState("");
  const [goalColor, setGoalColor] = useState(DEFAULT_GOAL_COLOR);
  const [hours, setHours] = useState(5);
  const [savedGoal, setSavedGoal] = useState<{
    id: string;
    title: string;
    hours: number;
    color: string;
  } | null>(null);

  // Habits.
  const [picked, setPicked] = useState<HabitPick[]>([]);
  const [habitDraft, setHabitDraft] = useState("");
  const [savedHabits, setSavedHabits] = useState<(HabitPick & { id: string })[]>([]);

  // Practice clock-in (the simulation itself lives in ClockStep).
  const [practiceTask, setPracticeTask] = useState("");
  const [clockRunning, setClockRunning] = useState(false);

  // Practice post.
  const [photo, setPhoto] = useState(false);
  const [caption, setCaption] = useState("");
  const [posted, setPosted] = useState(false);

  // Friends: the practice nudge, and whether the invite went out.
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudged, setNudged] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  const go = (i: number) => {
    // Moving FORWARD completes the current screen; Back does not.
    if (i > stepIndex) track("onboarding_step_completed", { step_name: step });
    setClockRunning(false);
    setNavIndex(Math.max(0, Math.min(steps.length - 1, i)));
  };

  // Analytics: the screen just entered, as a STEP NAME. Re-fires on Back (a
  // real re-entry) and never during the Done splash. setOnboardingStep is the
  // per-user "where did they stop" the dashboard reads; the event is the
  // timeline. Both no-op while ANALYTICS is off.
  useEffect(() => {
    if (done) return;
    track("onboarding_step_viewed", { step_name: step });
    void setOnboardingStep(step);
  }, [step, done]);
  const next = () => go(stepIndex + 1);

  // ── Writes ──────────────────────────────────────────────────────────────

  function claimUsername() {
    const check = checkUsername(username);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const name = displayName.trim();
    if (claimed && claimed.username === check.username && claimed.displayName === name) {
      go(1);
      return;
    }
    startTransition(async () => {
      if (claimed?.username !== check.username) {
        const r = await setUsername(check.username);
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
      }
      const identity = await setProfileIdentity({ displayName: name });
      if ("error" in identity) {
        toast.error(identity.error);
        return;
      }
      setClaimed({ username: check.username, displayName: name });
      go(1);
    });
  }

  function saveGoal() {
    const title = goalTitle.trim();
    if (!title) {
      toast.error("Give your goal a name first");
      return;
    }
    if (
      savedGoal &&
      savedGoal.title === title &&
      savedGoal.hours === hours &&
      savedGoal.color === goalColor
    ) {
      next();
      return;
    }
    startTransition(async () => {
      if (savedGoal) {
        const r = await updateGoal(savedGoal.id, {
          title,
          weeklyQuotaHours: hours,
          color: goalColor,
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        setSavedGoal({ ...savedGoal, title, hours, color: goalColor });
        track("goal_updated", { goal_id: savedGoal.id });
      } else {
        const r = await createGoal({ title, weeklyQuotaHours: hours, color: goalColor });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        setSavedGoal({ id: r.id, title, hours, color: goalColor });
        track("goal_created", { goal_id: r.id });
      }
      next();
    });
  }

  // Joins the cohort. Validation of the major and the clubs is setUwProfile's
  // job, not this one's — it is the only writer of those columns and the only
  // place that knows what lib/uw.ts considers valid.
  function saveUw(details: boolean) {
    startTransition(async () => {
      const r = await setUwProfile(
        details
          ? { isUw: true, major: uwMajor, clubs: uwClubs, shareGoals }
          : // Skipping still joins the cohort — they said they're at UW on the
            // welcome step, and that answer shouldn't quietly evaporate. With
            // no major or clubs they simply match on shared goals alone.
            { isUw: true }
      );
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      // Loaded here rather than on the next step's render: this is already an
      // await, and arriving at a list that pops in after a beat reads as a bug.
      // An empty list is a real answer (nobody matches yet), not a failure.
      const { peers: found } = await fetchUwPeers();
      setPeers(found);
      next();
    });
  }

  // Add a suggested peer. A real friend request, through the same action
  // /friends uses — the one thing on the old final step that was a rehearsal.
  function addPeer(userId: string) {
    setAddPending(userId);
    startTransition(async () => {
      const r = await sendFriendRequest(userId);
      setAddPending(null);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      track("friend_request_sent", { target_id: userId });
      setAdded((list) => (list.includes(userId) ? list : [...list, userId]));
    });
  }

  function toggleHabit(habit: HabitPick) {
    setPicked((list) =>
      list.some((h) => h.name === habit.name)
        ? list.filter((h) => h.name !== habit.name)
        : [...list, habit]
    );
  }

  function addOwnHabit(): HabitPick[] {
    const name = habitDraft.trim();
    if (!name) return picked;
    setHabitDraft("");
    if (picked.some((h) => h.name.toLowerCase() === name.toLowerCase())) return picked;
    const list = [...picked, { name, color: nextHabitColor(picked.length) }];
    setPicked(list);
    return list;
  }

  // Creates the picked habits that don't exist yet, archives the saved ones
  // that were un-picked, then moves on. Skipping writes nothing.
  function saveHabits() {
    const list = addOwnHabit();
    if (list.length === 0) {
      toast.error("Pick a habit or add your own — or skip");
      return;
    }
    startTransition(async () => {
      const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
      const saved = [...savedHabits];
      for (const h of list) {
        if (saved.some((s) => same(s.name, h.name))) continue;
        const r = await createHabit(h.name, h.color);
        if ("error" in r) {
          toast.error(r.error);
          setSavedHabits(saved);
          return;
        }
        saved.push({ ...h, id: r.id });
      }
      for (const s of savedHabits) {
        if (list.some((h) => same(h.name, s.name))) continue;
        const r = await archiveHabit(s.id);
        if (!("error" in r)) saved.splice(saved.findIndex((x) => x.id === s.id), 1);
      }
      setSavedHabits(saved);
      next();
    });
  }

  function askNotifications() {
    // Only asks when the state is `prompt`, so a replay on an already-answered
    // device shows no dialog; advances on ANY outcome — a refusal must never
    // trap someone in onboarding.
    if (notifyPermission !== "prompt") {
      track("notification_permission_skipped", {
        source: "onboarding",
        state: notifyPermission ?? "unknown",
      });
      next();
      return;
    }
    void requestNotificationPermission().then((result) => {
      track("notification_permission_asked", { source: "onboarding", result });
      // The habits they just saved get the default daily reminder, now that
      // reminders can actually arrive.
      if (result === "granted" && HABIT_REMINDERS && savedHabits.length > 0) {
        setHabitReminderPref({ enabled: true, time: DEFAULT_HABIT_REMINDER_TIME });
      }
      next();
    });
  }

  const invite = inviteMessage({ hours, goalTitle, habits: picked });

  async function share() {
    const outcome = await shareInvite(invite);
    if (outcome === "copied") toast.success("Invite copied — paste it to a friend");
    if (outcome === "failed")
      toast.error("Couldn't share — you can invite friends any time from your feed.");
    if (outcome === "shared" || outcome === "copied") setShared(true);
  }

  function finish() {
    setDone(true);
    router.prefetch("/");
    startTransition(async () => {
      const [r] = await Promise.all([completeOnboarding(), sleep(SPLASH_MS)]);
      if ("error" in r) {
        toast.error(r.error);
        setDone(false);
        return;
      }
      track("onboarding_completed");
      leave();
    });
  }

  // Exactly one navigation, chosen by where the wizard is actually mounted.
  // At `/` there is nowhere to go: completeOnboarding has already revalidated
  // the route, so re-rendering it is the whole job and a push would only
  // reinstate the cached pre-completion payload.
  function leave() {
    if (pathname === "/") router.refresh();
    else router.push("/");
  }

  function skipAll() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Onboarding skipped — replay it any time from Settings.");
      leave();
    });
  }

  // ── The primary CTA per step ─────────────────────────────────────────────

  const cta: Record<Step, { label: string; onClick: () => void; dim?: boolean }> = {
    welcome: {
      label: "Get started",
      onClick: () =>
        usernameValid ? claimUsername() : toast.error("Pick a username to continue"),
      dim: !usernameValid,
    },
    how: { label: "Continue", onClick: next },
    goal: { label: "Save goal", onClick: saveGoal, dim: !goalTitle.trim() },
    habit: {
      label: picked.length > 1 ? "Save habits" : "Save habit",
      onClick: saveHabits,
      dim: picked.length === 0 && !habitDraft.trim(),
    },
    clock: {
      label: clockRunning ? "Clocking in…" : "Clock in above to continue",
      onClick: () =>
        toast.info(clockRunning ? "Almost done — it's fast-forwarding" : "Tap Clock in to try it"),
      dim: true,
    },
    notify: {
      label: notifyPermission === "prompt" ? "Enable notifications" : "Continue",
      onClick: askNotifications,
    },
    post: {
      label: posted ? "Continue" : "Post above to continue",
      onClick: () => (posted ? next() : toast.info("Try posting — it's just practice")),
      dim: !posted,
    },
    uw: {
      label: "Continue",
      onClick: () =>
        uwMajor.trim() || uwClubs.length > 0
          ? saveUw(true)
          : toast.error("Pick a major or a club — or skip"),
      dim: !uwMajor.trim() && uwClubs.length === 0,
    },
    friends: {
      // A UW student who has already added someone has done the thing this
      // step exists for, so finishing stops being the quiet secondary option.
      label: shared || added.length > 0 ? "Start my week" : "Share with friends",
      onClick: () => (shared || added.length > 0 ? finish() : void share()),
    },
  };

  const quietSkip: Partial<Record<Step, { label: string; onClick: () => void }>> = {
    habit: {
      label: "Skip for now",
      onClick: () => {
        // Nothing new is written; the picks fall back to whatever was already
        // saved, so the invite message and summary stay honest.
        setPicked(savedHabits.map(({ name, color }) => ({ name, color })));
        setHabitDraft("");
        next();
      },
    },
    notify: {
      label: "Skip for now",
      onClick: () => {
        // Skipping is precisely NOT asking, which leaves the one-shot dialog
        // unspent for Settings or the live timer to offer later.
        track("notification_permission_skipped", {
          source: "onboarding",
          state: notifyPermission ?? "unknown",
        });
        next();
      },
    },
    uw: { label: "Skip for now", onClick: () => saveUw(false) },
    // Dropped once a peer has been added: the primary CTA already finishes, and
    // two buttons that do the same thing is just something to parse. Left in
    // place for the `shared` case, which behaved this way before any of this.
    ...(added.length > 0
      ? {}
      : { friends: { label: "Start my week without sharing", onClick: finish } }),
  };

  const eyebrow = eyebrowFor(step, steps);

  return (
    <div data-onboarding className="relative flex flex-1 flex-col overflow-hidden">
      {!done && (
        <header className="relative z-[2] flex h-16 flex-none items-center gap-2.5 px-5">
          {stepIndex > 0 ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => go(stepIndex - 1)}
              className="border-hairline text-caption hover:border-brand flex size-8 shrink-0 items-center justify-center rounded-[11px] border-[1.5px] transition-colors"
            >
              <ChevronLeftIcon className="size-[15px]" strokeWidth={2} />
            </button>
          ) : (
            <span className="size-8 shrink-0" />
          )}
          <span className="flex flex-1 justify-center gap-[5px]">
            {steps.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-[5px] rounded-full transition-all duration-300",
                  i === stepIndex
                    ? "bg-brand w-[18px]"
                    : i < stepIndex
                      ? "bg-brand/30 w-[5px]"
                      : "bg-control-border w-[5px]"
                )}
              />
            ))}
          </span>
          <button
            type="button"
            onClick={skipAll}
            disabled={pending}
            className="text-caption hover:text-ink w-8 shrink-0 text-right text-xs font-medium transition-colors disabled:opacity-50"
          >
            Skip
          </button>
        </header>
      )}

      <main
        key={step}
        className="relative z-[1] mx-auto flex w-full max-w-[420px] flex-1 flex-col overflow-y-auto overscroll-contain px-6"
      >
        {step === "welcome" && (
          <WelcomeStep
            displayName={displayName}
            onDisplayName={setDisplayName}
            username={username}
            onUsername={setUsernameInput}
            usernameValid={usernameValid}
            usernameError={usernameError}
            initialDisplayName={initialDisplayName}
            initialUsername={initialUsername}
            avatarUrl={avatarUrl}
            isUw={isUw}
            onIsUw={setIsUw}
            onSubmit={claimUsername}
            pending={pending}
          />
        )}
        {step === "how" && <HowStep eyebrow={eyebrow} />}
        {step === "goal" && (
          <GoalStep
            eyebrow={eyebrow}
            title={goalTitle}
            onTitle={setGoalTitle}
            color={goalColor}
            onColor={setGoalColor}
            hours={hours}
            onHours={setHours}
            onSubmit={saveGoal}
            pending={pending}
          />
        )}
        {step === "habit" && (
          <HabitStep
            eyebrow={eyebrow}
            picked={picked}
            onToggle={toggleHabit}
            draft={habitDraft}
            onDraft={setHabitDraft}
            onAdd={addOwnHabit}
          />
        )}
        {step === "clock" && (
          <ClockStep
            eyebrow={eyebrow}
            goalTitle={goalTitle}
            goalColor={goalColor}
            task={practiceTask}
            onTask={setPracticeTask}
            onRunningChange={setClockRunning}
            onDone={next}
          />
        )}
        {step === "notify" && <NotifyStep eyebrow={eyebrow} permission={notifyPermission} />}
        {step === "post" && (
          <PostStep
            eyebrow={eyebrow}
            name={displayName.trim() || initialDisplayName}
            username={username.trim() || initialUsername || "?"}
            avatarUrl={avatarUrl}
            goalTitle={goalTitle}
            goalColor={goalColor}
            photo={photo}
            onPhoto={() => setPhoto(true)}
            caption={caption}
            onCaption={setCaption}
            posted={posted}
            onPost={() => setPosted(true)}
          />
        )}
        {step === "uw" && (
          <UwStep
            eyebrow={eyebrow}
            major={uwMajor}
            onMajor={setUwMajor}
            clubs={uwClubs}
            onClubs={setUwClubs}
            shareGoals={shareGoals}
            onShareGoals={setShareGoals}
          />
        )}
        {step === "friends" && (
          <FriendsStep
            eyebrow={eyebrow}
            peers={peers}
            added={added}
            onAdd={addPeer}
            addPending={addPending}
            nudgeOpen={nudgeOpen}
            onOpenNudge={() => setNudgeOpen(true)}
            nudged={nudged}
            onNudge={setNudged}
          />
        )}
      </main>

      {!done && (
        <div className="relative z-[2] mx-auto flex w-full max-w-[420px] flex-none flex-col gap-2.5 px-6 pt-3.5 pb-[max(env(safe-area-inset-bottom),24px)]">
          <PrimaryButton
            size="screen"
            onClick={cta[step].onClick}
            disabled={pending}
            aria-disabled={cta[step].dim || undefined}
            className={cn(
              "transition-[transform,opacity] duration-200",
              cta[step].dim && "opacity-40"
            )}
          >
            {cta[step].label}
          </PrimaryButton>
          {quietSkip[step] && (
            <button
              type="button"
              onClick={quietSkip[step].onClick}
              className="text-caption hover:text-brand self-center p-0.5 text-xs font-medium transition-colors"
            >
              {quietSkip[step].label}
            </button>
          )}
        </div>
      )}

      {done && (
        <DoneSplash summary={doneSummary({ hours, goalTitle, habits: picked })} />
      )}
    </div>
  );
}
