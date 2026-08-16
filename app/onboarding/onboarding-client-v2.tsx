"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ClockIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";

import { track } from "@/lib/analytics";
import { AvatarPicker } from "@/components/avatar-picker";
import { ColorSwatches } from "@/components/color-swatches";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { InviteShare } from "@/components/v2/invite-share";
import { PrograMark } from "@/components/progra-mark";
import { cn } from "@/lib/utils";

import { createGoal } from "@/app/actions/goals";
import { createHabit } from "@/app/actions/habits";
import {
  completeOnboarding,
  setProfileIdentity,
  setUsername,
} from "@/app/actions/profile";
import { checkUsername } from "@/lib/social/username";

// First-run wizard. Eight steps, in the order the design lays them out:
// welcome (who you are) → first goal → a practice clock-in → a practice post →
// habits → what Sunday looks like → invite → go.
//
// Two of those steps are deliberately fake: the practice clock-in runs a
// fast-forwarded 25-minute simulation on the wall clock and writes nothing, and
// the practice post says so on screen. Everything else is real — the goal and
// the habits are created through the same actions the app uses, so someone
// finishes onboarding with a week already set up.
const STEPS = [
  "welcome",
  "goal",
  "clock",
  "post",
  "habit",
  "recap",
  "invite",
  "go",
] as const;
type Step = (typeof STEPS)[number];

// Numbered steps for the eyebrow — welcome and go aren't counted.
const NUMBERED: Step[] = ["goal", "clock", "post", "habit", "recap", "invite"];

// Preset habits, each with the reason it's worth doing (shown on the "?").
const PRESETS = [
  {
    name: "Journaling",
    color: "#6B639C",
    tip: "Expressive writing is linked to lower stress levels and better working memory.",
  },
  {
    name: "Meditation",
    color: "#46808A",
    tip: "A regular meditation practice measurably lowers cortisol and sharpens attention.",
  },
  {
    name: "Stretching",
    color: "#4E7A5F",
    tip: "Daily stretching improves circulation and reduces the risk of muscle injury.",
  },
  {
    name: "Drinking water",
    color: "#4A6FA5",
    tip: "Even mild dehydration measurably impairs concentration and mood.",
  },
];

// The practice session's target, and how long the simulation really takes.
const SIM_TARGET_MS = 25 * 60_000;
const SIM_REAL_MS = 3_300;
const SIM_REALTIME_MS = 1_500; // ticks at true speed before fast-forwarding

type Props = {
  initialUsername: string;
  initialDisplayName: string | null;
  avatarUrl: string | null;
};

export function OnboardingClientV2({
  initialUsername,
  initialDisplayName,
  avatarUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  // Identity (welcome).
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [username, setUsernameInput] = useState(initialUsername);
  const usernameCheck = username.trim() ? checkUsername(username) : null;
  const usernameError =
    usernameCheck && !usernameCheck.ok ? usernameCheck.error : null;
  const usernameValid = !!usernameCheck?.ok;

  // Goal.
  const [goalTitle, setGoalTitle] = useState("");
  const [hours, setHours] = useState(5);
  const [goalColorPick, setGoalColorPick] = useState<string | null>(
    CATEGORY_COLORS[6].value
  );
  const goalDisplay = goalTitle.trim() || "your first goal";
  // Whatever they picked paints the practice session, the Progress mock and the
  // summary, so the color they chose is the one they keep seeing.
  const goalTint = goalColorPick ?? CATEGORY_COLORS[6].value;

  // Practice clock-in.
  const [practiceTask, setPracticeTask] = useState("");
  const [sim, setSim] = useState(0);
  const [running, setRunning] = useState(false);
  const [fast, setFast] = useState(false);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (simTimer.current) clearInterval(simTimer.current);
    },
    []
  );

  // Practice post.
  const [photo, setPhoto] = useState(false);
  const [postText, setPostText] = useState("");
  const [posted, setPosted] = useState(false);

  // Habits.
  const [picked, setPicked] = useState<{ name: string; color: string }[]>([]);
  const [habitDraft, setHabitDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const go = (i: number) =>
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, i)));

  function claimUsername() {
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
      go(1);
    });
  }

  function saveGoal() {
    const title = goalTitle.trim();
    if (!title) {
      toast.error("Give your goal a name first");
      return;
    }
    startTransition(async () => {
      const r = await createGoal({
        title,
        weeklyQuotaHours: hours,
        color: goalColorPick,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      go(stepIndex + 1);
    });
  }

  function startPractice() {
    if (simTimer.current) clearInterval(simTimer.current);
    setRunning(true);
    setFast(false);
    setSim(0);
    const t0 = Date.now();
    simTimer.current = setInterval(() => {
      const real = Date.now() - t0;
      // Real seconds first, so it reads as a genuine timer, then an eased
      // fast-forward to the 25-minute target.
      let value: number;
      if (real < SIM_REALTIME_MS) {
        value = real;
      } else {
        const p = Math.min(1, (real - SIM_REALTIME_MS) / 1_800);
        value = SIM_REALTIME_MS + p * p * (SIM_TARGET_MS - SIM_REALTIME_MS);
        setFast(true);
      }
      if (real >= SIM_REAL_MS || value >= SIM_TARGET_MS) {
        if (simTimer.current) clearInterval(simTimer.current);
        setSim(SIM_TARGET_MS);
        setRunning(false);
        setFast(false);
        setStepIndex(STEPS.indexOf("post"));
        toast.success("25 minutes logged — practice, so it wasn't saved");
      } else {
        setSim(value);
      }
    }, 100);
  }

  function togglePreset(preset: { name: string; color: string }) {
    setPicked((list) =>
      list.some((h) => h.name === preset.name)
        ? list.filter((h) => h.name !== preset.name)
        : [...list, { name: preset.name, color: preset.color }]
    );
  }

  function addOwnHabit() {
    const name = habitDraft.trim();
    if (!name) return;
    if (picked.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
      setHabitDraft("");
      return;
    }
    // Own habits take the next palette color the presets haven't used.
    const color = PRESETS[picked.length % PRESETS.length].color;
    setPicked((list) => [...list, { name, color }]);
    setHabitDraft("");
  }

  // Creates every picked habit for real, then moves on. Skipping creates none.
  function saveHabits(next: number) {
    const pending = habitDraft.trim()
      ? [
          ...picked,
          {
            name: habitDraft.trim(),
            color: PRESETS[picked.length % PRESETS.length].color,
          },
        ]
      : picked;
    if (pending.length === 0) {
      toast.error("Pick a habit or add your own — or skip");
      return;
    }
    startTransition(async () => {
      for (const h of pending) {
        const r = await createHabit(h.name, h.color);
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
      }
      setHabitDraft("");
      go(next);
    });
  }

  function finish() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
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

  const inviteMessage = `My goal this week is to spend ${hours} hours on ${
    goalTitle.trim() ? `“${goalTitle.trim()}”` : "my goal"
  }.. help hold me accountable and make your own goals on Progra`;

  // The primary CTA per step: its label, and what it does. Gated steps nudge
  // with a toast rather than sitting there dead.
  const cta: Record<Step, { label: string; onClick: () => void; dim?: boolean }> =
    {
      welcome: {
        label: "Set your first goal",
        onClick: () =>
          usernameValid
            ? claimUsername()
            : toast.error("Pick a username to continue"),
        dim: !usernameValid,
      },
      goal: { label: "Save goal", onClick: saveGoal, dim: !goalTitle.trim() },
      clock: {
        label: running ? "Clocking in…" : "Clock in above to continue",
        onClick: () =>
          toast.info(
            running ? "Almost done — it's fast-forwarding" : "Tap Clock in to try it"
          ),
        dim: true,
      },
      post: {
        label: posted ? "Continue" : "Post above to continue",
        onClick: () =>
          posted
            ? go(stepIndex + 1)
            : toast.info("Try posting — it's just practice"),
        dim: !posted,
      },
      habit: {
        label: picked.length > 1 ? "Save habits" : "Save habit",
        onClick: () => saveHabits(stepIndex + 1),
        dim: picked.length === 0 && !habitDraft.trim(),
      },
      recap: { label: "Invite friends", onClick: () => go(stepIndex + 1) },
      invite: { label: "Continue", onClick: () => go(stepIndex + 1) },
      go: { label: "Start my week", onClick: finish },
    };

  const skippable = step === "habit" || step === "invite";

  return (
    <div data-onboarding className="relative flex flex-1 flex-col">
      {/* Back + progress dots */}
      <header className="flex h-[84px] flex-none items-center gap-2.5 px-5 pt-[max(env(safe-area-inset-top),20px)]">
        {stepIndex > 0 ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => go(stepIndex - 1)}
            className="border-hairline text-caption hover:border-brand flex size-8 shrink-0 items-center justify-center rounded-[11px] border-[1.5px]"
          >
            <ChevronLeftIcon className="size-[15px]" strokeWidth={2} />
          </button>
        ) : (
          <span className="size-8 shrink-0" />
        )}
        <span className="flex flex-1 justify-center gap-[5px]">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-[5px] rounded-full transition-all duration-300",
                i === stepIndex
                  ? "bg-brand w-[18px]"
                  : i < stepIndex
                    ? "w-[5px] bg-[#b7c4d3]"
                    : "bg-control-border w-[5px]"
              )}
            />
          ))}
        </span>
        <button
          type="button"
          onClick={skipAll}
          disabled={pending}
          className="text-caption hover:text-ink w-8 shrink-0 text-right text-xs font-medium disabled:opacity-50"
        >
          Skip
        </button>
      </header>

      <main
        key={step}
        className="mx-auto flex w-full max-w-[420px] flex-1 flex-col overflow-y-auto px-6"
      >
        {step === "welcome" && (
          <div className="flex flex-1 flex-col justify-center gap-[22px] pb-10">
            <PrograMark
              size={58}
              className="shadow-[0_14px_30px_-12px_rgba(28,58,94,.55)]"
              style={{
                animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both",
              }}
            />
            <h1 className="text-ink font-serif text-[40px] leading-[1.08] font-medium tracking-[-0.02em]">
              Welcome to
              <br />
              Progra.
            </h1>
            <p className="rise text-[16px] leading-[1.6] text-pretty text-[var(--secondary-ink)] [--rise-delay:.15s]">
              Progra helps you stop procrastinating on your goals by letting
              your friends see your progress and hold you accountable.
            </p>
            <div className="flex flex-col gap-3">
              {[
                ["#4A6FA5", "Set weekly hour goals"],
                ["#46808A", "Clock in and track your sessions"],
                ["#A98A38", "Friends see your progress — and your slack"],
              ].map(([color, label], i) => (
                <div
                  key={label}
                  className="rise flex items-center gap-[11px]"
                  style={
                    { "--rise-delay": `${0.3 + i * 0.12}s` } as React.CSSProperties
                  }
                >
                  <span
                    aria-hidden
                    className="size-[9px] shrink-0 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[13.5px] font-medium text-[var(--secondary-ink)]">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Identity — Progra needs a handle before anything else can be
                shared, so it's claimed here rather than in a settings screen. */}
            <div
              className="rise flex flex-col gap-3.5 pt-1"
              style={{ "--rise-delay": ".7s" } as React.CSSProperties}
            >
              <Field label="Your name" hint="Optional">
                <input
                  className="text-ink w-full border-b-2 border-[var(--hairline)] bg-transparent pb-2 text-[19px] font-medium tracking-[-0.01em] outline-none placeholder:text-[var(--disabled)]"
                  placeholder="Your name"
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>
              <Field label="Username" error={usernameError ?? undefined}>
                <div className="relative flex items-center">
                  <span className="text-caption pr-1 text-[19px]">@</span>
                  <input
                    className="text-ink min-w-0 flex-1 border-b-2 border-[var(--hairline)] bg-transparent pb-2 text-[19px] font-medium tracking-[-0.01em] outline-none placeholder:text-[var(--disabled)]"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="yourhandle"
                    value={username}
                    onChange={(e) =>
                      setUsernameInput(e.target.value.replace(/\s/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && usernameValid && !pending) {
                        e.preventDefault();
                        claimUsername();
                      }
                    }}
                  />
                  {usernameValid && (
                    <CheckIcon
                      className="text-brand ml-2 size-5 shrink-0"
                      strokeWidth={2.2}
                    />
                  )}
                </div>
              </Field>
              <AvatarPicker
                name={displayName.trim() || initialDisplayName}
                username={username.trim() || initialUsername || "?"}
                avatarUrl={avatarUrl}
                sizeClassName="size-14 text-lg"
              />
            </div>
          </div>
        )}

        {step === "goal" && (
          <StepBody
            step="goal"
            title="Set your first goal."
            body='Make it a specific, actionable thing you can put hours into every week — not "get fit", but "run 3x a week". You commit to a number of hours; Progra keeps score.'
          >
            <Field label="Your goal">
              <input
                className="text-ink w-full border-b-2 border-[var(--hairline)] bg-transparent pb-2 text-[19px] font-medium tracking-[-0.01em] outline-none placeholder:text-[var(--disabled)]"
                placeholder="e.g. Write thesis chapter 3"
                maxLength={120}
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !pending) {
                    e.preventDefault();
                    saveGoal();
                  }
                }}
              />
            </Field>
            <Field label="Color">
              <ColorSwatches value={goalColorPick} onChange={setGoalColorPick} />
            </Field>
            <Field label="Hours per week">
              <div className="flex items-center gap-4">
                <Stepper
                  label="Fewer hours"
                  disabled={hours <= 1}
                  onClick={() => setHours((h) => Math.max(1, h - 1))}
                >
                  <MinusIcon className="size-4" />
                </Stepper>
                <span className="stat-num min-w-[74px] text-center text-[30px] leading-none">
                  {hours}h
                </span>
                <Stepper
                  label="More hours"
                  disabled={hours >= 40}
                  onClick={() => setHours((h) => Math.min(40, h + 1))}
                >
                  <PlusIcon className="size-4" />
                </Stepper>
              </div>
            </Field>
          </StepBody>
        )}

        {step === "clock" && (
          <StepBody
            step="clock"
            title="Try clocking in."
            body="Every hour starts with a clock-in: name the session, pick the goal, go. This practice one is set to 25 minutes — we'll fast-forward it for you."
          >
            <div className="border-control-border flex flex-col gap-3.5 rounded-2xl border-[1.5px] p-4">
              {!running ? (
                <>
                  <Field label="Name this session">
                    <div className="border-control-border flex items-center rounded-[13px] border-[1.5px]">
                      <input
                        className="text-ink h-12 min-w-0 flex-1 bg-transparent pl-3.5 text-[15px] font-medium outline-none placeholder:text-[var(--disabled)]"
                        placeholder="e.g. Quick run around neighborhood"
                        value={practiceTask}
                        onChange={(e) => setPracticeTask(e.target.value)}
                      />
                      <span className="text-disabled px-3.5 text-xs font-medium whitespace-nowrap">
                        + note
                      </span>
                    </div>
                  </Field>
                  <div className="flex gap-2">
                    <span className="border-control-border text-body flex h-[38px] min-w-0 flex-1 items-center justify-center gap-[7px] rounded-xl border-[1.5px] px-2.5 text-[12.5px] font-semibold">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: goalTint }}
                      />
                      <span className="truncate">{goalDisplay}</span>
                      <ChevronDownIcon
                        className="text-disabled size-3 shrink-0"
                        strokeWidth={2.4}
                      />
                    </span>
                    <span className="border-control-border text-body flex h-[38px] shrink-0 items-center gap-[7px] rounded-xl border-[1.5px] px-3 text-[12.5px] font-semibold">
                      <ClockIcon className="text-caption size-[13px]" />
                      25m
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={startPractice}
                    className="bg-brand text-primary-foreground h-[50px] w-full rounded-[14px] text-[15px] font-semibold shadow-[0_10px_22px_-10px_rgba(28,58,94,.55)] transition-transform active:scale-[.98]"
                  >
                    Clock in for 25m
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="stat-num text-[52px] leading-[0.95]">
                      {formatSim(sim)}
                    </span>
                    <div className="flex items-center gap-[7px] pt-2">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 animate-[pulse-dot_1.6s_infinite] rounded-full"
                        style={{ backgroundColor: goalTint }}
                      />
                      <span className="text-body truncate text-[13px] font-semibold">
                        {practiceTask.trim() || goalDisplay}
                      </span>
                      <span className="flex-1" />
                      <span className="text-faint text-xs whitespace-nowrap">
                        25m target
                      </span>
                    </div>
                  </div>
                  <div className="bg-track h-2 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-[width] duration-100 ease-linear"
                      style={{
                        width: `${Math.min(100, (sim / SIM_TARGET_MS) * 100)}%`,
                        backgroundColor: goalTint,
                      }}
                    />
                  </div>
                  <span className="text-caption text-center text-xs font-medium">
                    {fast
                      ? "Fast-forwarding — you get the idea."
                      : "It's running. Sit back — we'll fast-forward this one."}
                  </span>
                </>
              )}
            </div>
          </StepBody>
        )}

        {step === "post" && (
          <StepBody
            step="post"
            title="Nice — now share it."
            body={
              <>
                When you clock out, you can post the session to your feed —
                usually with a photo of what you got done. Try it —{" "}
                <strong className="text-body font-semibold">
                  this is practice, nothing will actually be posted.
                </strong>
              </>
            }
          >
            <div className="border-control-border flex flex-col gap-3 rounded-2xl border-[1.5px] p-4">
              <div className="flex items-center gap-2.5">
                <span className="bg-inset text-caption flex size-[34px] items-center justify-center rounded-full text-[13px] font-semibold">
                  You
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body text-[13px] font-semibold">
                    Your first session
                  </span>
                  <span className="text-faint truncate text-[11px]">
                    25m · {goalDisplay}
                  </span>
                </div>
                <span
                  aria-hidden
                  className="size-[9px] shrink-0 rounded-[2px]"
                  style={{ backgroundColor: goalTint }}
                />
              </div>
              {photo ? (
                <div className="flex h-[76px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#dfe5ec,#eef0f3)]">
                  <ImageIcon className="size-4 text-[var(--secondary-ink)]" />
                  <span className="text-xs font-semibold whitespace-nowrap text-[var(--secondary-ink)]">
                    desk-photo.jpg attached
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPhoto(true)}
                  className="text-caption hover:border-brand flex h-[76px] w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#d5d9df] bg-[var(--inset-2)] text-[12.5px] font-semibold"
                >
                  <ImageIcon className="size-4" />
                  Add a photo
                </button>
              )}
              <input
                className="text-ink w-full border-b-2 border-[var(--hairline)] bg-transparent pb-2 text-sm outline-none placeholder:text-[var(--disabled)]"
                placeholder="Say something about it…"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
              {posted ? (
                <div className="flex items-center gap-2 pt-0.5">
                  <CheckIcon
                    className="size-4 text-[var(--success)]"
                    strokeWidth={2.4}
                  />
                  <span className="text-[13px] font-semibold text-[var(--success)]">
                    Got it — that&rsquo;s the whole flow. Nothing was posted.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPosted(true);
                    toast.success("Practice only — nothing was posted");
                  }}
                  className="bg-brand text-primary-foreground h-[46px] w-full rounded-[13px] text-sm font-semibold transition-transform active:scale-[.98]"
                >
                  Post to feed
                </button>
              )}
            </div>
          </StepBody>
        )}

        {step === "habit" && (
          <StepBody
            step="habit"
            title="Quick habits, too."
            body="Not everything needs a timer. Habits are one-tap daily check-offs on your Progress tab, right under your week."
          >
            {/* A mock of the Progress tab, so the habits land somewhere the
                user recognises later. */}
            <div className="border-control-border overflow-hidden rounded-2xl border-[1.5px]">
              <div className="flex flex-col gap-1.5 px-3.5 pt-3 pb-2.5 opacity-45">
                <div className="flex items-center gap-[7px]">
                  <span className="section-label">This week</span>
                  <span className="flex-1" />
                  <span className="text-caption text-[10px] font-semibold">
                    {hours}h goal
                  </span>
                </div>
                <span className="stat-num text-[22px] leading-[0.9]">2.1h</span>
                <div className="bg-track flex h-[7px] overflow-hidden rounded-full">
                  <div
                    className="h-full"
                    style={{ width: "42%", backgroundColor: goalTint }}
                  />
                </div>
              </div>
              <div className="border-hairline flex flex-col gap-2 border-t px-3.5 pt-2.5 pb-3">
                <div className="flex items-center gap-[7px]">
                  <span className="text-brand text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Habits
                  </span>
                  <span className="flex-1" />
                  <span className="text-caption text-[10px] font-semibold">
                    0 of {Math.max(picked.length, 1)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-[9px] gap-y-1.5">
                  {(picked.length > 0
                    ? picked
                    : [{ name: "Your habits…", color: null }]
                  ).map((h) => (
                    <div
                      key={h.name}
                      className="flex min-w-0 items-center gap-[7px] rounded-[12px] border-[1.5px] py-[5px] pr-[9px] pl-[7px]"
                      style={{
                        borderColor: h.color ?? "var(--control-border)",
                        backgroundColor: h.color ? "#fff" : "var(--inset-2)",
                      }}
                    >
                      <span
                        className="size-5 shrink-0 rounded-[7px] border-[1.5px] bg-white"
                        style={{
                          borderColor: h.color ?? "#d5d9df",
                        }}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs font-medium",
                          h.color ? "text-body" : "text-disabled"
                        )}
                      >
                        {h.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="section-label">Pick a few to start</span>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const on = picked.some((h) => h.name === p.name);
                  return (
                    <div key={p.name} className="relative flex">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePreset(p)}
                        className="text-body flex min-w-0 flex-1 items-center gap-[7px] rounded-[12px] border-[1.5px] bg-white px-2.5 py-2 text-[12.5px] font-semibold transition-transform active:scale-[.96]"
                        style={{
                          borderColor: on ? p.color : "var(--control-border)",
                        }}
                      >
                        <span
                          className="flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] text-white"
                          style={{
                            borderColor: on ? p.color : "#d5d9df",
                            backgroundColor: on ? p.color : "#fff",
                          }}
                        >
                          {on && (
                            <CheckIcon className="size-3" strokeWidth={3.2} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left">
                          {p.name}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Why ${p.name}?`}
                          onMouseEnter={() => setHint(p.name)}
                          onMouseLeave={() => setHint(null)}
                          onFocus={() => setHint(p.name)}
                          onBlur={() => setHint(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHint(hint === p.name ? null : p.name);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setHint(hint === p.name ? null : p.name);
                            }
                          }}
                          className="text-caption flex size-4 shrink-0 cursor-help items-center justify-center rounded-full border-[1.5px] border-[#d5d9df] text-[10px] font-semibold"
                        >
                          ?
                        </span>
                      </button>
                      <span
                        role="tooltip"
                        className={cn(
                          "text-primary-foreground pointer-events-none absolute bottom-[calc(100%+7px)] z-10 w-[206px] rounded-[10px] bg-[#12171d] px-[11px] py-2 text-[11px] leading-[1.5] shadow-[0_10px_24px_-8px_rgba(18,23,29,.45)] transition-opacity",
                          hint === p.name ? "opacity-100" : "opacity-0",
                          PRESETS.indexOf(p) % 2 === 0 ? "left-0" : "right-0"
                        )}
                      >
                        {p.tip}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-end gap-2 pt-0.5">
                <input
                  className="text-ink min-w-0 flex-1 border-b-2 border-[var(--hairline)] bg-transparent pb-2 text-[15px] font-medium outline-none placeholder:text-[var(--disabled)]"
                  placeholder="Or add your own…"
                  value={habitDraft}
                  onChange={(e) => setHabitDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOwnHabit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addOwnHabit}
                  className="border-hairline text-brand hover:border-brand h-[34px] shrink-0 rounded-[11px] border-[1.5px] px-3 text-xs font-semibold"
                >
                  + Add
                </button>
              </div>
            </div>
          </StepBody>
        )}

        {step === "recap" && (
          <StepBody
            step="recap"
            title="Sunday settles it."
            body={`At the end of the week you get a recap: did you hit your ${hours}h, or not. Your friends get one too — and everyone can see who showed up.`}
          >
            <div className="border-control-border overflow-hidden rounded-2xl border-[1.5px]">
              <div className="flex items-center gap-[7px] px-3.5 pt-3 pb-2">
                <span className="section-label">
                  This week&rsquo;s leaderboard
                </span>
              </div>
              {[
                ["1", "MP", "Maya P.", "hit 8h goal", "8.6h", "hit ✓", true],
                ["2", "Y", "You", goalDisplay, `${hours}h`, "on track", false],
                ["3", "PS", "Priya S.", "hit 6h goal", "6.4h", "hit ✓", true],
                ["4", "SK", "Sam K.", "missed 6h goal", "4.1h", "missed ✗", false],
              ].map(([rank, initials, name, sub, hoursLabel, badge, hit]) => (
                <div
                  key={rank as string}
                  className="border-divider flex items-center gap-[11px] border-t px-3.5 py-2"
                  style={
                    name === "You"
                      ? { backgroundColor: "var(--tint-you)" }
                      : undefined
                  }
                >
                  <span className="text-ink w-4 text-center font-serif text-[13px] font-semibold tabular-nums">
                    {rank as string}
                  </span>
                  <span className="bg-inset text-caption flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                    {initials as string}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body text-[12.5px] font-semibold">
                      {name as string}
                    </span>
                    <span className="text-faint truncate text-[10.5px]">
                      {sub as string}
                    </span>
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--secondary-ink)]">
                    {hoursLabel as string}
                  </span>
                  <span
                    className={cn(
                      "w-[60px] shrink-0 text-right text-[11px] font-semibold whitespace-nowrap",
                      hit ? "text-[var(--success)]" : "text-cat-burnt",
                      name === "You" && "text-brand"
                    )}
                  >
                    {badge as string}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-faint text-xs">
              That little &ldquo;missed&rdquo; is the whole trick. Nobody wants
              the little &ldquo;missed&rdquo;.
            </span>
          </StepBody>
        )}

        {step === "invite" && (
          <StepBody
            step="invite"
            title="Want to take your goals seriously?"
            body="Invite friends to hold you accountable. Progra works because someone is watching."
          >
            <div className="border-control-border bg-inset flex flex-col gap-3 rounded-2xl border-[1.5px] p-4">
              <span className="section-label">Your invite message</span>
              <p className="text-ink font-serif text-[15px] leading-[1.55] text-pretty">
                “{inviteMessage}”
              </p>
            </div>
            <InviteShare
              username={username.trim() || initialUsername}
              message={inviteMessage}
            />
          </StepBody>
        )}

        {step === "go" && (
          <div className="flex flex-1 flex-col justify-center gap-5 pb-10">
            <h1 className="text-ink font-serif text-[52px] leading-[1.02] font-medium tracking-[-0.03em]">
              <span className="rise inline-block">Ready.</span>
              <br />
              <span
                className="rise inline-block"
                style={{ "--rise-delay": ".45s" } as React.CSSProperties}
              >
                Set.
              </span>
              <br />
              <span
                className="text-brand rise inline-block"
                style={{ "--rise-delay": ".95s" } as React.CSSProperties}
              >
                GO!
              </span>
            </h1>
            <p
              className="rise text-[15px] leading-[1.6] text-pretty text-[var(--secondary-ink)]"
              style={{ "--rise-delay": "1.5s" } as React.CSSProperties}
            >
              Your week starts now: {hours} hours on “{goalDisplay}”
              {picked.length > 0
                ? `, plus ${picked.map((h) => h.name.toLowerCase()).join(", ")} every day.`
                : "."}{" "}
              Your friends will see how it goes.
            </p>
            <div
              className="rise flex flex-col gap-2.5"
              style={{ "--rise-delay": "1.8s" } as React.CSSProperties}
            >
              <div className="border-hairline flex items-center gap-2.5 border-t pt-2.5">
                <span
                  aria-hidden
                  className="size-[9px] shrink-0 rounded-[2px]"
                  style={{ backgroundColor: goalTint }}
                />
                <span className="text-body min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                  {goalDisplay}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--secondary-ink)]">
                  {hours}h/wk
                </span>
              </div>
              {picked.length > 0 && (
                <div className="border-hairline flex items-center gap-2.5 border-t pt-2.5">
                  <CheckIcon
                    className="text-caption size-3.5 shrink-0"
                    strokeWidth={2.2}
                  />
                  <span className="text-body min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                    {picked.map((h) => h.name).join(", ")}
                  </span>
                  <span className="text-faint shrink-0 text-xs whitespace-nowrap">
                    {picked.length > 1 ? "daily habits" : "daily habit"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Pinned CTA */}
      <div className="flex flex-none flex-col gap-2.5 px-6 pt-3.5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <button
          type="button"
          onClick={cta[step].onClick}
          disabled={pending}
          className={cn(
            "bg-brand text-primary-foreground h-[52px] w-full rounded-[15px] text-base font-semibold shadow-[0_10px_22px_-10px_rgba(28,58,94,.55)] transition-[transform,opacity] active:scale-[.98]",
            cta[step].dim && "opacity-40"
          )}
        >
          {cta[step].label}
        </button>
        {skippable && (
          <button
            type="button"
            onClick={() => {
              if (step === "habit") {
                setPicked([]);
                setHabitDraft("");
              }
              go(stepIndex + 1);
            }}
            className="text-caption hover:text-brand self-center text-xs font-medium"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

// The shared shape of a middle step: numbered eyebrow, serif title, body copy,
// then whatever that step's controls are — each entering on the rise stagger.
function StepBody({
  step,
  title,
  body,
  children,
}: {
  step: Step;
  title: string;
  body: React.ReactNode;
  children: React.ReactNode;
}) {
  const n = NUMBERED.indexOf(step) + 1;
  const practice = step === "clock" || step === "post";
  return (
    <div className="flex flex-col gap-[18px] pt-[18px] pb-6">
      <span className="section-label rise">
        Step {n} of {NUMBERED.length}
        {practice && " · Practice"}
      </span>
      <h1
        className="text-ink rise font-serif text-[30px] leading-[1.12] font-medium tracking-[-0.02em]"
        style={{ "--rise-delay": ".1s" } as React.CSSProperties}
      >
        {title}
      </h1>
      <p
        className="rise text-sm leading-[1.6] text-pretty text-[var(--secondary-ink)]"
        style={{ "--rise-delay": ".25s" } as React.CSSProperties}
      >
        {body}
      </p>
      <div
        className="rise flex flex-col gap-[18px]"
        style={{ "--rise-delay": ".4s" } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  // A quiet note ("Optional"); `error` is the same slot in terracotta.
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="section-label">{label}</span>
        {(error || hint) && (
          <span
            className={cn(
              "text-[11px]",
              error ? "text-destructive" : "text-faint"
            )}
          >
            {error ?? hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stepper({
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
      className="border-hairline text-caption flex size-[38px] items-center justify-center rounded-xl border-[1.5px] transition-transform active:scale-90 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

// m:ss for the practice simulation.
function formatSim(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
