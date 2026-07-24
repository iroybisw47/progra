"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertCircleIcon,
  BarChart3Icon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  MinusIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";

import { AvatarPicker } from "@/components/avatar-picker";
import { PrograMark } from "@/components/progra-mark";
import {
  Conversation,
  ControlBlock,
  type Utterance,
} from "@/components/onboarding/conversation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { createGoal } from "@/app/actions/goals";
import {
  completeOnboarding,
  setProfileIdentity,
  setUsername,
} from "@/app/actions/profile";
import { checkUsername } from "@/lib/social/username";

// Conversational onboarding: on each step Progra "types", the copy streams in
// word-by-word (components/onboarding/conversation.tsx), then the controls +
// CTA fade up. Structure/motion/copy follow the design handoff; all colors are
// Progra's navy V2 tokens (recolor-only). Six steps; the actions/logic are the
// same ones the previous static wizard used.
type Step = "welcome" | "about" | "goal" | "categories" | "habits" | "calendar";
const SEQUENCE: Step[] = [
  "welcome",
  "about",
  "goal",
  "categories",
  "habits",
  "calendar",
];

// Per-step conversation copy (title = big, then body lines).
const SCRIPT: Record<Step, Utterance[]> = {
  welcome: [
    { big: true, text: "Welcome to Progra" },
    {
      big: false,
      text: "Track deep work, see where your time goes, and share progress with friends.",
    },
    { big: false, text: "First — tell us who you are." },
  ],
  about: [
    { big: true, text: "So, what is Progra?" },
    {
      big: false,
      text: "A shared study room in your pocket. You clock in, put real time on the things that matter, and your friends see you showing up.",
    },
    {
      big: false,
      text: "Goals, habits and your calendar all land in one simple week view.",
    },
  ],
  goal: [
    { big: true, text: "Set your first goal" },
    {
      big: false,
      text: "Something you want to put real hours into each week.",
    },
    {
      big: false,
      text: "Just one to start — you can add more goals any time later.",
    },
  ],
  categories: [
    { big: true, text: "Goals aren't everything" },
    {
      big: false,
      text: "You can clock into plain categories too — Reading, Class, Gym — with no target attached.",
    },
    {
      big: false,
      text: "And if you sync your calendar, events file themselves into the right category.",
    },
  ],
  habits: [
    { big: true, text: "Habits, too" },
    {
      big: false,
      text: "Daily habits live alongside timed goals — check them off to keep your weekly streak alive.",
    },
    { big: false, text: "Here's everything you get:" },
  ],
  calendar: [
    { big: true, text: "See your whole week" },
    {
      big: false,
      text: "Connect Google Calendar and your classes and meetings count themselves — no clocking in.",
    },
    {
      big: false,
      text: "Access is read-only. Progra never creates or edits your events.",
    },
  ],
};

// Flipped to "0" once Google's app verification clears (build-time inlined).
const SHOW_UNVERIFIED_WARNING =
  process.env.NEXT_PUBLIC_SHOW_UNVERIFIED_WARNING === "1";

type Props = {
  initialUsername: string;
  initialDisplayName: string | null;
  avatarUrl: string | null;
  calendarConnected: boolean;
  initialStep?: Step;
  status?: "connected" | "error" | null;
};

export function OnboardingClientV2({
  initialUsername,
  initialDisplayName,
  avatarUrl,
  calendarConnected,
  initialStep,
  status = null,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(initialStep ?? "welcome");

  // The CTA bar lives outside the message column, so it fades in when the
  // conversation reports "ready". Derived (which step's text has finished) so
  // it auto-resets when `step` changes — no effect needed.
  // Conversation.onReady always fires (end of stream, or immediately under
  // reduced-motion), so seeding null is safe for every entry incl. deep-links.
  const [readyStep, setReadyStep] = useState<Step | null>(null);
  const ready = readyStep === step;

  // One-shot toast for the connect flow's return status.
  const statusToastFired = useRef(false);
  useEffect(() => {
    if (statusToastFired.current || !status) return;
    statusToastFired.current = true;
    if (status === "error") {
      toast.error(
        "Google Calendar wasn't connected — you can try again from Settings."
      );
    } else {
      toast.success("Google Calendar connected");
    }
  }, [status]);

  // Welcome: name + handle.
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [username, setUsernameInput] = useState(initialUsername);
  const usernameCheck = username.trim() ? checkUsername(username) : null;
  const usernameError =
    usernameCheck && !usernameCheck.ok ? usernameCheck.error : null;
  const usernameValid = !!usernameCheck?.ok;

  // Goal.
  const [goalTitle, setGoalTitle] = useState("");
  const [quota, setQuota] = useState(5);

  const idx = SEQUENCE.indexOf(step);
  const go = (s: Step) => setStep(s);

  function handleClaimUsername() {
    const check = checkUsername(username);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    startTransition(async () => {
      const r = await setUsername(check.username);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const identity = await setProfileIdentity({ displayName });
      if ("error" in identity) {
        toast.error(identity.error);
        return;
      }
      go("about");
    });
  }

  function handleCreateGoal() {
    const title = goalTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const r = await createGoal({ title, weeklyQuotaHours: quota });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      go("categories");
    });
  }

  function handleFinish() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("You're all set — welcome to Progra.");
      router.push("/");
    });
  }

  function handleSkip() {
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

  // The Skip chrome shows on the middle steps only (not welcome or calendar,
  // which has its own "Skip for now").
  const showSkip = step !== "welcome" && step !== "calendar";

  return (
    <div
      data-onboarding
      className="relative flex flex-1 flex-col"
    >
      {/* Progress dots + Skip */}
      <div className="relative flex h-12 items-center justify-center gap-1.5 pt-[max(env(safe-area-inset-top),8px)]">
        {SEQUENCE.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              i === idx
                ? "bg-brand w-[26px]"
                : i < idx
                  ? "bg-brand/50 w-4"
                  : "bg-track w-1.5"
            )}
          />
        ))}
        {showSkip && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className="text-caption hover:text-ink absolute right-5 text-[14px] font-bold transition-opacity active:opacity-55 disabled:opacity-50"
          >
            Skip
          </button>
        )}
      </div>

      {/* Message + controls column */}
      <main
        key={step}
        className="mx-auto flex w-full max-w-[420px] flex-1 animate-[fade-up_.35s_ease] flex-col px-5 pb-28"
      >
        <div className="flex flex-1 flex-col justify-center gap-6">
          {/* Step icon (pops in). Welcome/about show the Progra clock mark;
              calendar shows the calendar glyph in a brand circle. */}
          {(step === "welcome" || step === "about") && (
            <PrograMark
              size={58}
              className="shadow-[0_10px_26px_rgba(28,58,94,.22)]"
              style={{
                animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both",
              }}
            />
          )}
          {step === "calendar" && (
            <span
              className="bg-brand flex size-[58px] items-center justify-center rounded-full shadow-[0_10px_26px_rgba(28,58,94,.22)]"
              style={{ animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both" }}
            >
              <CalendarIcon
                className="text-primary-foreground size-6"
                strokeWidth={1.9}
              />
            </span>
          )}

          <Conversation
            utterances={SCRIPT[step]}
            stepKey={step}
            onReady={() => setReadyStep(step)}
          >
            {step === "welcome" && (
              <WelcomeControls
                displayName={displayName}
                setDisplayName={setDisplayName}
                username={username}
                setUsername={setUsernameInput}
                usernameError={usernameError}
                usernameValid={usernameValid}
                avatarUrl={avatarUrl}
                initialDisplayName={initialDisplayName}
                initialUsername={initialUsername}
                onEnter={() => usernameValid && !pending && handleClaimUsername()}
              />
            )}
            {step === "goal" && (
              <GoalControls
                goalTitle={goalTitle}
                setGoalTitle={setGoalTitle}
                quota={quota}
                setQuota={setQuota}
                onEnter={() =>
                  goalTitle.trim() && !pending && handleCreateGoal()
                }
              />
            )}
            {step === "categories" && (
              <ControlBlock>
                <CategoriesExample />
              </ControlBlock>
            )}
            {step === "habits" && (
              <ControlBlock>
                <HabitsExample />
              </ControlBlock>
            )}
            {step === "calendar" && (
              <ControlBlock>
                <CalendarBody
                  connected={calendarConnected}
                  showWarning={SHOW_UNVERIFIED_WARNING}
                />
              </ControlBlock>
            )}
          </Conversation>
        </div>
      </main>

      {/* Pinned CTA bar — fades in once the text is done. */}
      {ready && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[var(--screen)] via-[var(--screen)] to-transparent px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-6"
          style={{ animation: "fade-up 0.5s 0.1s ease both" }}
        >
          <div className="pointer-events-auto mx-auto w-full max-w-[420px]">
            {step === "welcome" && (
              <Cta
                onClick={handleClaimUsername}
                disabled={!usernameValid || pending}
              >
                Get started
              </Cta>
            )}
            {step === "about" && <Cta onClick={() => go("goal")}>Next</Cta>}
            {step === "goal" && (
              <Cta
                onClick={handleCreateGoal}
                disabled={!goalTitle.trim() || pending}
              >
                Create goal
              </Cta>
            )}
            {step === "categories" && (
              <Cta onClick={() => go("habits")}>Next</Cta>
            )}
            {step === "habits" && (
              <Cta onClick={() => go("calendar")}>Next</Cta>
            )}
            {step === "calendar" &&
              (calendarConnected ? (
                <Cta onClick={handleFinish} disabled={pending}>
                  Finish
                </Cta>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Plain navigation — the route handler stamps onboarded_at
                      before redirecting to Google. */}
                  <a
                    href="/auth/google-calendar?from=onboarding"
                    className={buttonVariants({
                      className:
                        "h-12 w-full rounded-xl text-base font-bold active:scale-[.97]",
                    })}
                  >
                    Connect Google Calendar
                  </a>
                  <Button
                    variant="ghost"
                    onClick={handleFinish}
                    disabled={pending}
                    className="text-caption h-11 w-full rounded-xl text-sm font-bold"
                  >
                    Skip for now
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Cta({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full rounded-xl text-base font-bold active:scale-[.97]"
    >
      {children}
    </Button>
  );
}

// ── Step controls ──────────────────────────────────────────────────────────

function WelcomeControls({
  displayName,
  setDisplayName,
  username,
  setUsername,
  usernameError,
  usernameValid,
  avatarUrl,
  initialDisplayName,
  initialUsername,
  onEnter,
}: {
  displayName: string;
  setDisplayName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  usernameError: string | null;
  usernameValid: boolean;
  avatarUrl: string | null;
  initialDisplayName: string | null;
  initialUsername: string;
  onEnter: () => void;
}) {
  return (
    <>
      <ControlBlock index={0}>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="ob-name">Name</Label>
            <span className="text-faint text-xs">Optional</span>
          </div>
          <Input
            id="ob-name"
            className="h-12 rounded-xl text-base"
            placeholder="Your name"
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="text-faint text-[12.5px]">
            Shown to friends alongside your handle.
          </p>
        </div>
      </ControlBlock>

      <ControlBlock index={1}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ob-username">Username</Label>
          <div className="relative">
            <span className="text-caption pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base">
              @
            </span>
            <Input
              id="ob-username"
              className="h-12 rounded-xl pl-[35px] pr-10 text-base"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourhandle"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnter();
                }
              }}
            />
            {usernameValid && (
              <span
                className="text-brand absolute right-3 top-1/2 -translate-y-1/2"
                style={{ animation: "pop-in 0.35s ease both" }}
              >
                <CheckIcon className="size-5" strokeWidth={2.2} />
              </span>
            )}
          </div>
          <p
            className={cn(
              "text-[12.5px]",
              usernameError ? "text-destructive" : "text-faint"
            )}
          >
            {usernameError ?? "Lowercase letters, numbers and underscores."}
          </p>
        </div>
      </ControlBlock>

      <ControlBlock index={2}>
        <div className="flex flex-col gap-2">
          <Label>Profile photo</Label>
          <AvatarPicker
            name={displayName.trim() || initialDisplayName}
            username={username.trim() || initialUsername || "?"}
            avatarUrl={avatarUrl}
            sizeClassName="size-14 text-lg"
          />
        </div>
      </ControlBlock>
    </>
  );
}

function GoalControls({
  goalTitle,
  setGoalTitle,
  quota,
  setQuota,
  onEnter,
}: {
  goalTitle: string;
  setGoalTitle: (v: string) => void;
  quota: number;
  setQuota: (fn: (q: number) => number) => void;
  onEnter: () => void;
}) {
  return (
    <>
      <ControlBlock index={0}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ob-goal">Goal title</Label>
          <Input
            id="ob-goal"
            className="h-12 rounded-xl text-base"
            placeholder="Thesis writing"
            maxLength={120}
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }}
          />
        </div>
      </ControlBlock>

      <ControlBlock index={1}>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label>Weekly target</Label>
            <span className="text-faint text-xs">1–40h</span>
          </div>
          <div className="border-hairline bg-card flex items-center gap-3 rounded-[18px] border p-[18px]">
            <StepperButton
              label="Decrease target"
              disabled={quota <= 1}
              onClick={() => setQuota((q) => Math.max(1, q - 1))}
            >
              <MinusIcon className="size-5" />
            </StepperButton>
            <div className="flex flex-1 flex-col items-center">
              <span className="text-ink font-mono text-4xl font-bold tabular-nums">
                {quota}h
              </span>
              <span className="text-faint text-[12.5px]">per week</span>
            </div>
            <StepperButton
              label="Increase target"
              disabled={quota >= 40}
              onClick={() => setQuota((q) => Math.min(40, q + 1))}
            >
              <PlusIcon className="size-5" />
            </StepperButton>
          </div>
        </div>
      </ControlBlock>
    </>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-hairline bg-card text-ink flex size-[46px] items-center justify-center rounded-full border transition-transform active:scale-90 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function CategoriesExample() {
  const rows = [
    { color: "var(--chart-1)", name: "Classes", hours: "6.5h" },
    { color: "var(--chart-2)", name: "Reading", hours: "2.5h" },
    { color: "var(--chart-3)", name: "Gym", hours: "1.5h" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="border-hairline bg-card flex flex-col rounded-[18px] border px-[18px]">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center gap-2.5 py-[15px]",
              i > 0 && "border-divider border-t"
            )}
          >
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <span className="text-ink flex-1 text-[15px] font-bold">
              {r.name}
            </span>
            <span className="text-ink font-mono text-[15px] tabular-nums">
              {r.hours}
            </span>
            <span className="text-faint text-xs">this week</span>
          </div>
        ))}
      </div>
      <p className="text-caption text-[12.5px]">
        Manage categories any time from Settings → Categories.
      </p>
    </div>
  );
}

function HabitsExample() {
  // Mon–Thu done, Fri = today, Sat/Sun upcoming.
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const state = ["done", "done", "done", "done", "today", "future", "future"];
  const overview = [
    {
      icon: BarChart3Icon,
      name: "Progress",
      body: "Your goals, habits and totals, at a glance.",
    },
    {
      icon: UsersIcon,
      name: "Feed",
      body: "See friends' sessions and cheer them on.",
    },
    {
      icon: ClockIcon,
      name: "Clock",
      body: "One tap to start tracking, right from the middle tab.",
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="border-hairline bg-card flex flex-col gap-3.5 rounded-[18px] border p-[18px]">
        <div className="flex items-center gap-2">
          <span className="bg-brand text-primary-foreground flex size-[19px] items-center justify-center rounded-full">
            <CheckIcon className="size-3" strokeWidth={3} />
          </span>
          <span className="text-ink flex-1 text-[15px] font-bold">
            Read 20 min
          </span>
          <span className="text-brand text-xs font-bold">4-day streak</span>
        </div>
        <div className="flex items-center justify-between">
          {days.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-[26px] items-center justify-center rounded-full",
                  state[i] === "done" && "bg-brand text-primary-foreground",
                  state[i] === "today" && "border-brand border-2",
                  state[i] === "future" && "bg-track"
                )}
                style={
                  state[i] === "today"
                    ? { animation: "pulse-dot 2s ease-in-out infinite" }
                    : undefined
                }
              >
                {state[i] === "done" && (
                  <CheckIcon className="size-3" strokeWidth={2.6} />
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold",
                  state[i] === "today"
                    ? "text-brand"
                    : state[i] === "future"
                      ? "text-faint/70"
                      : "text-faint"
                )}
              >
                {d}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-caption text-[11px] font-bold uppercase tracking-[0.06em]">
          What&rsquo;s inside
        </span>
        {overview.map((o) => {
          const Icon = o.icon;
          return (
            <div key={o.name} className="flex items-start gap-3">
              <Icon className="text-brand mt-0.5 size-5 shrink-0" strokeWidth={1.9} />
              <div className="flex flex-col gap-0.5">
                <span className="text-ink text-sm font-bold">{o.name}</span>
                <span className="text-caption text-[12.5px]">{o.body}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarBody({
  connected,
  showWarning,
}: {
  connected: boolean;
  showWarning: boolean;
}) {
  if (connected) {
    return (
      <div
        className="border-hairline bg-card flex items-center gap-3 rounded-[18px] border px-4 py-3.5"
        style={{ animation: "pop-in 0.35s ease both" }}
      >
        <span className="bg-brand/10 text-brand flex size-[38px] shrink-0 items-center justify-center rounded-full">
          <CheckIcon className="size-4" strokeWidth={3} />
        </span>
        <div className="flex flex-col">
          <span className="text-ink text-[15px] font-bold">
            Google Calendar connected
          </span>
          <span className="text-caption text-[12.5px]">
            Read-only — disconnect any time in Settings.
          </span>
        </div>
      </div>
    );
  }
  if (!showWarning) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-[#eadfae] bg-[#faf3de] px-3.5 py-3">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-[#9c7c2c]" />
      <p className="text-[12.5px] leading-relaxed text-[#7c6524]">
        Google may show an &ldquo;unverified app&rdquo; screen. Tap{" "}
        <strong>Advanced</strong>, then{" "}
        <strong>Go to progra.world (unsafe)</strong> to continue. Access is
        read-only.
      </p>
    </div>
  );
}
