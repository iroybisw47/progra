"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeftIcon } from "lucide-react";

import { archiveHabit, createHabit } from "@/app/actions/habits";
import { createGoal, updateGoal } from "@/app/actions/goals";
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
  const [pending, startTransition] = useTransition();

  // The notify step exists only in the shell. `native` flips at most once,
  // immediately after hydration, while the user is still on `welcome` at index
  // 0 — which is the load-bearing reason the list changing length underneath
  // stepIndex is safe. It can never shift a step the user is partway through.
  const native = useIsNativeApp();
  const steps = activeSteps(native);
  // Production always starts at 0. The preview's `initialStep` is looked up in
  // whichever list contains it — `notify` only exists in the native one.
  const [stepIndex, setStepIndex] = useState(() =>
    Math.max(0, activeSteps(initialStep === "notify").indexOf(initialStep ?? "welcome"))
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];
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
    setClockRunning(false);
    setStepIndex(Math.max(0, Math.min(steps.length - 1, i)));
  };
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
      } else {
        const r = await createGoal({ title, weeklyQuotaHours: hours, color: goalColor });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        setSavedGoal({ id: r.id, title, hours, color: goalColor });
      }
      next();
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

  const usernameForLink = username.trim() || initialUsername || "you";
  const invite = inviteMessage({ hours, goalTitle, habits: picked });

  async function share() {
    const outcome = await shareInvite(invite, usernameForLink);
    if (outcome === "copied") toast.success("Invite copied — paste it to a friend");
    if (outcome === "failed") toast.error("Couldn't share — copy the link from Friends later.");
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
      router.push("/");
    });
  }

  function skipAll() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Onboarding skipped — replay it any time from Settings.");
      router.push("/");
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
    friends: {
      label: shared ? "Start my week" : "Share with friends",
      onClick: () => (shared ? finish() : void share()),
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
    friends: { label: "Start my week without sharing", onClick: finish },
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
        {step === "friends" && (
          <FriendsStep
            eyebrow={eyebrow}
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
