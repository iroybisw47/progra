"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AtSignIcon, ClockIcon, FlagIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createGoal } from "@/app/actions/goals";
import { completeOnboarding, setUsername } from "@/app/actions/profile";
import { clockIn, clockOut } from "@/app/actions/sessions";
import { checkUsername } from "@/lib/social/username";
import type { Goal } from "@/lib/db/goals";

const HOUR_MS = 60 * 60 * 1000;

// m:ss under an hour, h:mm:ss past it.
function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// "42s" / "3m 12s" / "1.4h" for the success banner.
function formatLogged(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  if (ms < HOUR_MS) return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`;
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

type Step = "welcome" | "goal" | "practice" | "categories" | "habits";
const SEQUENCE: Step[] = ["welcome", "goal", "practice", "categories", "habits"];

type Props = {
  goals: Goal[];
  initialUsername: string;
  activeSession: { taskName: string; startedAt: number } | null;
};

// The redesign onboarding: five compact steps (welcome + handle → first goal →
// practice timer → categories explainer → habits intro), dropping the
// pre-redesign spotlight tour. Reuses the same actions (setUsername, createGoal,
// clockIn/clockOut, completeOnboarding) so it's a presentation change only.
export function OnboardingClientV2({
  goals,
  initialUsername,
  activeSession,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("welcome");

  // Welcome + handle.
  const [username, setUsernameInput] = useState(initialUsername);
  const usernameCheck = username.trim() ? checkUsername(username) : null;
  const usernameError =
    usernameCheck && !usernameCheck.ok ? usernameCheck.error : null;

  // Goal.
  const [goalTitle, setGoalTitle] = useState("");
  const [quota, setQuota] = useState(5);
  const [createdGoalTitle, setCreatedGoalTitle] = useState<string | null>(null);

  // Practice.
  const [practicePhase, setPracticePhase] = useState<
    "idle" | "running" | "done"
  >("idle");
  const [taskName, setTaskName] = useState("First practice session");
  const [clockAtMs, setClockAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loggedMs, setLoggedMs] = useState(0);

  const practiceGoalTitle = createdGoalTitle ?? goals[0]?.title ?? "your goal";

  // Adopt a real in-flight session on replay so clockIn doesn't trip the
  // one-active-session constraint.
  useEffect(() => {
    if (step === "practice" && practicePhase === "idle" && activeSession) {
      setTaskName(activeSession.taskName);
      setClockAtMs(activeSession.startedAt);
      setPracticePhase("running");
    }
  }, [step, practicePhase, activeSession]);

  useEffect(() => {
    if (practicePhase !== "running") return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [practicePhase]);

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
      setStep("goal");
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
      setCreatedGoalTitle(title);
      router.refresh();
      setStep("practice");
    });
  }

  function handleClockIn() {
    const goal =
      goals.find((g) => g.title === createdGoalTitle) ?? goals[0] ?? null;
    if (!goal) {
      toast.error("Your goal is still saving — try again in a second.");
      router.refresh();
      return;
    }
    const name = taskName.trim() || "First practice session";
    startTransition(async () => {
      const r = await clockIn({ goalId: goal.id, taskName: name });
      if ("error" in r) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      setClockAtMs(Date.now());
      setNowMs(Date.now());
      setPracticePhase("running");
    });
  }

  function handleClockOut() {
    startTransition(async () => {
      const r = await clockOut();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setLoggedMs(Date.now() - (clockAtMs ?? Date.now()));
      setPracticePhase("done");
      router.refresh();
    });
  }

  function handleFinish() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push("/");
    });
  }

  return (
    <div key={step} className="flex flex-1 animate-[fade-up_.35s_ease] flex-col">
      <div className="flex h-11 items-center justify-center gap-1.5">
        {SEQUENCE.map((s, i) => (
          <span
            key={s}
            className={
              "h-1 rounded-full transition-all " +
              (i <= SEQUENCE.indexOf(step)
                ? "bg-brand w-6"
                : "bg-track w-3")
            }
          />
        ))}
      </div>

      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5 pb-10">
        <div className="flex flex-1 flex-col justify-center gap-6">
          {step === "welcome" && (
            <>
              <span className="bg-brand flex size-14 items-center justify-center rounded-full">
                <ClockIcon
                  className="text-primary-foreground size-6"
                  strokeWidth={1.9}
                />
              </span>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-4xl leading-[1.12] tracking-[-0.01em]">
                  Welcome to Progra
                </h1>
                <p className="text-body text-base leading-relaxed text-pretty">
                  Track deep work, see where your time goes, and share progress
                  with friends. First, claim your handle.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ob-username">
                  <AtSignIcon className="text-caption size-3.5" />
                  Username
                </Label>
                <Input
                  id="ob-username"
                  className="h-12 rounded-xl text-base"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="yourhandle"
                  value={username}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
                {usernameError && (
                  <p className="text-destructive text-[13px]">{usernameError}</p>
                )}
                <p className="text-caption text-[13px]">
                  Lowercase letters, numbers, and underscores. You can change it
                  later.
                </p>
              </div>
            </>
          )}

          {step === "goal" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Set your first goal
                </h1>
                <p className="text-body text-[15px] leading-normal">
                  Something you want to put real hours into each week.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ob-goal">Goal</Label>
                <Input
                  id="ob-goal"
                  className="h-12 rounded-xl text-base"
                  placeholder="e.g. Learn Spanish"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Weekly quota</Label>
                <div className="border-hairline bg-card flex items-center gap-3 rounded-xl border p-2">
                  <button
                    type="button"
                    aria-label="Decrease quota"
                    onClick={() => setQuota((q) => Math.max(1, q - 1))}
                    className="border-hairline bg-track hover:bg-track/70 size-11 rounded-[10px] border text-xl"
                  >
                    −
                  </button>
                  <div className="flex flex-1 flex-col items-center">
                    <span className="text-ink text-2xl font-bold tabular-nums">
                      {quota}h
                    </span>
                    <span className="text-caption text-[11px]">per week</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase quota"
                    onClick={() => setQuota((q) => Math.min(40, q + 1))}
                    className="border-hairline bg-track hover:bg-track/70 size-11 rounded-[10px] border text-xl"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "practice" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Try clocking in
                </h1>
                <p className="text-body text-[15px] leading-normal">
                  This is the whole loop — clock in when you start, out when you
                  stop. Give it a few seconds.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                <span className="text-caption text-xs">Clocking in to</span>
                <span className="text-brand border-brand/25 bg-brand/10 inline-flex items-center gap-2 self-start rounded-full border px-3.5 py-2 text-sm font-bold">
                  <FlagIcon className="size-3.5" strokeWidth={2} />
                  Goal: {practiceGoalTitle}
                </span>
              </div>

              {practicePhase === "idle" && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ob-task">What are you working on?</Label>
                    <Input
                      id="ob-task"
                      className="h-12 rounded-xl text-base"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleClockIn}
                    disabled={pending}
                    className="h-14 w-full gap-2.5 rounded-2xl text-[17px] font-bold"
                  >
                    <PlayIcon className="size-4 fill-current" />
                    Clock in
                  </Button>
                </>
              )}

              {practicePhase === "running" && (
                <>
                  <div className="border-hairline bg-card flex flex-col items-center gap-2.5 rounded-[18px] border px-5 py-7">
                    <span className="text-caption flex items-center gap-2 text-xs">
                      <span className="bg-brand size-[9px] animate-pulse rounded-full" />
                      {taskName.trim() || "First practice session"}
                    </span>
                    <span className="text-ink text-[54px] font-bold tracking-[-0.01em] tabular-nums">
                      {formatElapsed(nowMs - (clockAtMs ?? nowMs))}
                    </span>
                  </div>
                  <Button
                    onClick={handleClockOut}
                    disabled={pending}
                    variant="secondary"
                    className="h-13 w-full rounded-[14px] text-base font-medium"
                  >
                    Clock out
                  </Button>
                </>
              )}

              {practicePhase === "done" && (
                <div className="border-done/55 bg-done/15 flex items-center gap-3 rounded-[14px] border px-4 py-3.5">
                  <span className="bg-done text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    ✓
                  </span>
                  <p className="text-body text-sm leading-snug">
                    Logged <strong>{formatLogged(loggedMs)}</strong> toward{" "}
                    <strong>{practiceGoalTitle}</strong>. Every session counts
                    toward your weekly quota.
                  </p>
                </div>
              )}
            </>
          )}

          {step === "categories" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  Goals aren&rsquo;t everything
                </h1>
                <p className="text-body text-[15px] leading-normal text-pretty">
                  You can clock in to plain categories too — and merged calendar
                  events get filed into them automatically, so meetings count
                  without any clocking.
                </p>
              </header>
              <div className="border-hairline bg-card flex flex-col rounded-[18px] border px-4 py-1.5">
                <ExampleCategoryRow color="var(--chart-3)" name="Exercise" hours="2.5h" divider />
                <ExampleCategoryRow color="var(--chart-2)" name="Reading" hours="1.2h" divider />
                <ExampleCategoryRow color="var(--chart-4)" name="Admin" hours="0.8h" />
              </div>
              <p className="text-caption text-[13px]">
                Manage categories any time from Settings → Categories.
              </p>
            </>
          )}

          {step === "habits" && (
            <>
              <header className="flex flex-col gap-2">
                <h1 className="text-ink text-[32px] leading-[1.15]">
                  You&rsquo;re all set
                </h1>
                <p className="text-body text-[15px] leading-normal text-pretty">
                  Track daily habits alongside your timed goals — a compact
                  weekly grid on your profile shows your streak at a glance.
                </p>
              </header>
              <ul className="flex flex-col gap-3">
                <ReadyRow title="Progress" body="Today, this week, and your history in one place." />
                <ReadyRow title="Feed" body="See what friends are working on." />
                <ReadyRow title="Clock" body="Tap the center button any time to start a session." />
              </ul>
            </>
          )}
        </div>

        {step === "welcome" && (
          <WizardCta
            onClick={handleClaimUsername}
            disabled={!usernameCheck?.ok || pending}
          >
            Get started
          </WizardCta>
        )}
        {step === "goal" && (
          <WizardCta
            onClick={handleCreateGoal}
            disabled={!goalTitle.trim() || pending}
          >
            Create goal
          </WizardCta>
        )}
        {step === "practice" && practicePhase === "done" && (
          <WizardCta onClick={() => setStep("categories")}>Continue</WizardCta>
        )}
        {step === "categories" && (
          <WizardCta onClick={() => setStep("habits")}>Next</WizardCta>
        )}
        {step === "habits" && (
          <WizardCta onClick={handleFinish} disabled={pending}>
            Start using Progra
          </WizardCta>
        )}
      </main>
    </div>
  );
}

function WizardCta({
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
      className="h-12 w-full rounded-xl text-base font-bold"
    >
      {children}
    </Button>
  );
}

function ExampleCategoryRow({
  color,
  name,
  hours,
  divider,
}: {
  color: string;
  name: string;
  hours: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 py-3 ${divider ? "border-divider border-b" : ""}`}
    >
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-ink flex-1 text-[15px]">{name}</span>
      <span className="text-caption text-[13px] tabular-nums">
        {hours} this week
      </span>
    </div>
  );
}

function ReadyRow({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="bg-brand mt-1.5 size-2 shrink-0 rounded-full" />
      <div className="flex flex-col gap-0.5">
        <span className="text-ink text-[15px] font-bold">{title}</span>
        <span className="text-body text-sm leading-normal">{body}</span>
      </div>
    </li>
  );
}
