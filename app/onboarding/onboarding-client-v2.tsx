"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AtSignIcon, ClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createGoal } from "@/app/actions/goals";
import { completeOnboarding, setUsername } from "@/app/actions/profile";
import { checkUsername } from "@/lib/social/username";

type Step = "welcome" | "goal" | "categories" | "habits";
const SEQUENCE: Step[] = ["welcome", "goal", "categories", "habits"];

type Props = {
  initialUsername: string;
};

// The redesign onboarding: four compact steps (welcome + handle → first goal →
// categories explainer → habits intro), dropping the pre-redesign spotlight
// tour. Creating the goal is the only write here (via createGoal) — no practice
// session; a new member surfaces on friends' feeds as a "just joined" item.
export function OnboardingClientV2({ initialUsername }: Props) {
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
      setStep("categories");
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

  // Skip the rest of the wizard once the username step is done. Same completion
  // path as handleFinish; only reachable past the welcome step, so the handle is
  // always claimed by the time this can fire.
  function handleSkip() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("You're all set");
      router.push("/");
    });
  }

  return (
    <div key={step} className="flex flex-1 animate-[fade-up_.35s_ease] flex-col">
      <div className="relative flex h-11 items-center justify-center gap-1.5">
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
        {step !== "welcome" && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className="text-caption hover:text-ink absolute right-5 text-[13px] font-medium disabled:opacity-50"
          >
            Skip
          </button>
        )}
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
